import { generateText, generateImage, requestAIText, projectRoot } from './lib/openai';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import * as fsLib from 'fs';
import crypto from 'crypto';
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}


const currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath((import.meta || {}).url || "file://"));

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


let db: import('better-sqlite3').Database;

const DB_FILE = path.join(projectRoot, 'ehub.db');
const CHUNK_SIZE = 500 * 1024; // 500KB chunks of binary data (safe for Firestore base64)

let dbFirestore: any;
let isFirebaseReady = false;

try {
  const configStr = fsLib.readFileSync(path.join(projectRoot, 'firebase-applet-config.json'), 'utf-8');
  const firebaseConfig = JSON.parse(configStr);
  const fbApp = initializeApp(firebaseConfig);
  dbFirestore = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  // Disabled due to quota limit: isFirebaseReady = true;
  console.log("Firebase initialized but disabled due to quota limits.");
} catch (e) {
  console.log("Firebase not configured or missing config.");
}

async function backupSQLiteToFirestore() {
  if (!isFirebaseReady) return;
  try {
    const data = fsLib.readFileSync(DB_FILE);
    const base64Data = data.toString('base64');
    const chunks = [];
    for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
      chunks.push(base64Data.substring(i, i + CHUNK_SIZE));
    }
    
    // Process in batches of 10 to respect 500 max ops per batch
    let batch = writeBatch(dbFirestore);
    batch.set(doc(dbFirestore, 'sqlite_backup', 'metadata'), {
      chunksCount: chunks.length,
      updatedAt: new Date().toISOString()
    });
    
    for (let i = 0; i < chunks.length; i++) {
       batch.set(doc(dbFirestore, 'sqlite_backup', `chunk_${i}`), {
          data: chunks[i],
          index: i
       });
       
       if ((i + 2) % 400 === 0) { // commit and get a new batch
           await batch.commit();
           batch = writeBatch(dbFirestore);
       }
    }
    await batch.commit();
    console.log(`[Backup] SQLite backed up successfully (${chunks.length} chunks) to Firestore`);
  } catch (e: any) {
    console.error("[Backup] Backup failed:", e);
    if (e?.code === 'resource-exhausted' || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.log("Disabling Firebase backup due to quota limit.");
      isFirebaseReady = false;
    }
  }
}

async function restoreSQLiteFromFirestore() {
  if (!isFirebaseReady) return false;
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Firestore timeout")), 4000)
  );

  try {
    const metaDoc = await Promise.race([
      getDoc(doc(dbFirestore, 'sqlite_backup', 'metadata')),
      timeoutPromise
    ]) as any;

    if (!metaDoc.exists()) {
      console.log("[Restore] No backup found in Firestore.");
      return false;
    }
    const chunksCount = metaDoc.data()?.chunksCount || 0;
    if (chunksCount === 0) return false;
    
    let base64Data = '';
    for (let i = 0; i < chunksCount; i++) {
       const chunkDoc = await Promise.race([
         getDoc(doc(dbFirestore, 'sqlite_backup', `chunk_${i}`)),
         timeoutPromise
       ]) as any;
       if (chunkDoc.exists()) {
          base64Data += chunkDoc.data()?.data || '';
       }
    }
    if (base64Data) {
        let buffer = Buffer.from(base64Data, 'base64');
        fsLib.writeFileSync(DB_FILE, buffer);
        console.log("[Restore] Transferred SQLite DB from Firestore to local.");
    }
    return true;
  } catch (e: any) {
    console.error("[Restore] Restore failed or timed out:", e);
    if (e?.code === 'resource-exhausted' || e?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.log("Disabling Firebase backup due to quota limit.");
      isFirebaseReady = false;
    }
    return false;
  }
}

let lastBackupTime = Date.now();
async function backupIfChanged() {
  try {
    const stat = fsLib.statSync(DB_FILE);
    if (stat.mtimeMs > lastBackupTime) {
      lastBackupTime = Date.now();
      await backupSQLiteToFirestore();
    }
  } catch (e) {}
}

async function bootDb() {
  await restoreSQLiteFromFirestore();

  // Initialize SQLite Database
  const setupDb = () => {
    db = new Database(DB_FILE);
    db.pragma('foreign_keys = ON');

    db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    avatar TEXT,
    plan TEXT DEFAULT 'free',
    org_plan TEXT DEFAULT 'basic'
  );

    CREATE TABLE IF NOT EXISTS stage_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    item_type TEXT,
    user_id INTEGER,
    stage INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, item_type, user_id)
  );

  CREATE TABLE IF NOT EXISTS idea_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    image TEXT,
    author_id INTEGER,
    proposer_id INTEGER,
    approver_id INTEGER,
    change_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    FOREIGN KEY(idea_id) REFERENCES ideas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    image TEXT,
    author_id INTEGER,
    quoted_item_id INTEGER,
    quoted_item_type TEXT,
    stage INTEGER DEFAULT 1,
    is_private BOOLEAN DEFAULT 0,
    permitted_users TEXT DEFAULT '[]',
    is_recruitment BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER,
    project_id INTEGER,
    user_id INTEGER,
    parent_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS idea_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER,
    project_id INTEGER,
    follower_id INTEGER,
    is_mutual BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'pending',
    reason TEXT,
    skills TEXT,
    role TEXT,
    period TEXT,
    hours TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER,
    project_id INTEGER,
    user_id INTEGER,
    recipient_id INTEGER,
    content TEXT,
    type TEXT DEFAULT 'text', -- 'text', 'contact', 'image', 'file'
    metadata TEXT, -- JSON string for extra data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    image TEXT,
    images TEXT,
    author_id INTEGER,
    status TEXT DEFAULT 'active',
    quoted_item_id INTEGER,
    quoted_item_type TEXT,
    stage INTEGER DEFAULT 1,
    latest_idea_id INTEGER,
    latest_idea_at DATETIME,
    is_private BOOLEAN DEFAULT 0,
    permitted_users TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_id INTEGER,
    subscribed_to_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(subscribed_to_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(subscriber_id, subscribed_to_id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_id INTEGER,
    item_type TEXT, -- 'idea' or 'project'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_id, item_type)
  );

  CREATE TABLE IF NOT EXISTS archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_id INTEGER,
    item_type TEXT, -- 'idea' or 'project'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_id, item_type)
  );

  CREATE TABLE IF NOT EXISTS message_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_id INTEGER,
    item_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    from_user_id INTEGER,
    to_user_id INTEGER,
    rating INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, from_user_id, to_user_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    message TEXT,
    from_user_id INTEGER,
    item_id INTEGER,
    item_type TEXT, -- 'idea', 'project'
    follow_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(user_id, project_id)
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    project_id INTEGER,
    amount INTEGER,
    tier_description TEXT,
    stripe_session_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memo_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER,
    folder_id INTEGER,
    title TEXT DEFAULT 'New Note',
    content TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES memo_folders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS buyouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT,
    item_id INTEGER,
    creator_id INTEGER,
    buyout_type TEXT,
    price INTEGER,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    winner_id INTEGER,
    winning_price INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS buyout_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyout_id INTEGER,
    user_id INTEGER,
    price INTEGER,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auction_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyout_id INTEGER,
    user_id INTEGER,
    amount INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  
  
  CREATE TABLE IF NOT EXISTS user_follows (
    follower_id INTEGER,
    following_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(following_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    project_id INTEGER,
    reference_item_type TEXT,
    reference_item_id INTEGER,
    reference_item_title TEXT,
    title TEXT,
    message TEXT,
    role TEXT,
    period TEXT,
    reward_type TEXT,
    reward_amount TEXT,
    time_estimate TEXT,
    location TEXT,
    online_offline TEXT,
    deadline DATETIME,
    nda TEXT,
    notes TEXT,
    status TEXT DEFAULT 'sent',
    decline_reason TEXT,
    hold_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS scout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scout_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES scout_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    idea_id INTEGER,
    author_id INTEGER,
    title TEXT NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    event_type TEXT DEFAULT '会議',
    is_all_day INTEGER DEFAULT 0,
    description TEXT,
    location TEXT,
    meeting_url TEXT,
    assignee_id INTEGER,
    attendees TEXT,
    related_project_id INTEGER,
    related_idea_id INTEGER,
    related_proposal_id INTEGER,
    related_task TEXT,
    completion_criteria TEXT,
    priority TEXT DEFAULT 'normal',
    reminders TEXT,
    notify_target TEXT DEFAULT 'all',
    visibility TEXT DEFAULT 'all',
    attachments TEXT,
    recurrence TEXT DEFAULT 'none',
    recurrence_end_date DATETIME,
    recurrence_count INTEGER,
    status TEXT DEFAULT 'unstarted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedule_rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'tentative',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, user_id),
    FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Add folder_id to memos
try {
  db.exec("ALTER TABLE memos ADD COLUMN folder_id INTEGER REFERENCES memo_folders(id) ON DELETE CASCADE");
} catch (e) {}

// Add status column if it doesn't exist (migration)
try {
  db.exec("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'");
} catch (e) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN images TEXT");
} catch (e) {}

try { db.exec("ALTER TABLE projects ADD COLUMN completed_title TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN completed_description TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN completed_images TEXT"); } catch (e) {}

// Privacy columns migration
try { db.exec("ALTER TABLE ideas ADD COLUMN is_private BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN permitted_users TEXT DEFAULT '[]'"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN is_private BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN permitted_users TEXT DEFAULT '[]'"); } catch (e) {}

// Add quote columns if they don't exist
try {
  db.exec("ALTER TABLE ideas ADD COLUMN quoted_item_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE ideas ADD COLUMN quoted_item_type TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN quoted_item_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE projects ADD COLUMN quoted_item_type TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN stage INTEGER DEFAULT 1");
} catch (e) {}

try {
  db.exec("ALTER TABLE ideas ADD COLUMN stage INTEGER DEFAULT 1");
} catch (e) {}

// Add parent_id to comments if it doesn't exist
try {
  db.exec("ALTER TABLE comments ADD COLUMN parent_id INTEGER");
} catch (e) {}

// Add project_id to comments and idea_follows if they don't exist (migration)
try {
  db.exec("ALTER TABLE comments ADD COLUMN project_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE idea_follows ADD COLUMN project_id INTEGER");
} catch (e) {}
// Add project_id to messages if it doesn't exist (migration)
try {
  db.exec("ALTER TABLE messages ADD COLUMN project_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE messages ADD COLUMN recipient_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'");
} catch (e) {}
try {
  db.exec("ALTER TABLE messages ADD COLUMN metadata TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE notifications ADD COLUMN follow_id INTEGER");
} catch (e) {}

// Scout schema extensions
try { db.exec("ALTER TABLE scouts ADD COLUMN source_type TEXT DEFAULT 'direct'"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN recruitment_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN offer_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN idea_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN nda_contract_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN outsourcing_contract_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN outsourcing_body TEXT"); } catch (e) {}

// New tables for recruitment idea selection status and offer status
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS idea_selection_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recruitment_id INTEGER NOT NULL,
      idea_id INTEGER NOT NULL,
      org_id INTEGER NOT NULL,
      status TEXT DEFAULT 'unreviewed',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recruitment_id, idea_id, org_id)
    );
  `);
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS offer_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER NOT NULL,
      org_id INTEGER NOT NULL,
      status TEXT DEFAULT 'sent',
      internal_memo TEXT,
      rejection_message TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(offer_id, org_id)
    );
  `);
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS idea_reads (
      idea_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (idea_id, user_id)
    );
  `);
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL, -- 'nda' | 'outsourcing' | 'other'
      category TEXT DEFAULT 'common', -- 'recruitment' | 'offer' | 'scout' | 'common'
      body TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      author_id INTEGER NOT NULL,
      organization_id INTEGER,
      is_template INTEGER DEFAULT 1,
      status TEXT DEFAULT 'available', -- 'draft' | 'available' | 'archived'
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contract_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      change_summary TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contract_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      contract_version INTEGER DEFAULT 1,
      target_type TEXT NOT NULL, -- 'recruitment' | 'offer' | 'scout'
      target_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending' | 'agreed' | 'rejected'
      signature_name TEXT,
      agreed_at DATETIME,
      ip_address TEXT,
      user_agent TEXT,
      pdf_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contract_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER,
      agreement_id INTEGER,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contract_ai_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER,
      user_id INTEGER NOT NULL,
      month_year TEXT NOT NULL, -- 'YYYY-MM'
      generation_count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, month_year)
    );
    CREATE TABLE IF NOT EXISTS contract_ai_generation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      generation_type TEXT DEFAULT 'chat',
      contract_type TEXT NOT NULL, -- 'nda' | 'outsourcing'
      source_screen TEXT NOT NULL, -- 'scout_create' | 'contract_library'
      generation_session_id TEXT,
      year_month TEXT NOT NULL, -- 'YYYY-MM'
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'success' -- 'success' | 'failed'
    );
  `);
} catch (e) {}

try { db.exec("ALTER TABLE contract_ai_limits ADD COLUMN organization_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE contracts ADD COLUMN status TEXT DEFAULT 'available'"); } catch (e) {}
try { db.exec("ALTER TABLE contracts ADD COLUMN usage_count INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE contracts ADD COLUMN last_used_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE contracts ADD COLUMN description TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE contracts ADD COLUMN tags TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE contracts ADD COLUMN sharing_scope TEXT DEFAULT 'all'"); } catch (e) {}
try { db.exec("ALTER TABLE contract_versions ADD COLUMN previous_version INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE contract_versions ADD COLUMN content_hash TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN snapshot_title TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN snapshot_body TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN content_hash TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN scout_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN project_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN counterparty_org_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN agreement_method TEXT DEFAULT 'electronic_signature'"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN language TEXT DEFAULT 'ja'"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN agreement_ui_version TEXT DEFAULT 'v1.0'"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN is_revoked INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE contract_agreements ADD COLUMN is_void INTEGER DEFAULT 0"); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS contract_ai_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER,
    organization_id INTEGER,
    user_id INTEGER NOT NULL,
    session_id TEXT,
    contract_type TEXT,
    sanitized_prompt TEXT,
    ai_reply TEXT,
    contract_body_snapshot TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    idea_id INTEGER,
    organization_account_id INTEGER NOT NULL,
    individual_account_id INTEGER NOT NULL,
    project_contract_type TEXT NOT NULL DEFAULT 'participation', -- 'participation' | 'completion' | 'joint_business'
    legal_contract_type TEXT DEFAULT 'outsourcing_quasi_mandate', -- 'outsourcing_quasi_mandate' | 'outsourcing_contract' | 'joint_venture' | 'custom'
    title TEXT,
    role TEXT,
    objective TEXT,
    scope_of_work TEXT,
    deliverables TEXT,
    delivery_date TEXT,
    start_date TEXT,
    end_date TEXT,
    duration TEXT,
    activity_scale TEXT,
    compensation_types TEXT DEFAULT '["fixed"]', -- JSON array of strings
    gross_amount REAL DEFAULT 0,
    platform_fee_rate REAL DEFAULT 0.15,
    platform_fee_amount REAL DEFAULT 0,
    individual_net_amount REAL DEFAULT 0,
    initial_reward_amount REAL DEFAULT 0,
    performance_reward_amount REAL DEFAULT 0,
    revenue_share_rate REAL DEFAULT 0,
    revenue_share_period TEXT,
    revenue_share_target TEXT,
    cost_burden TEXT,
    ip_rights TEXT,
    termination_conditions TEXT,
    payment_cycle TEXT DEFAULT 'monthly',
    payment_due_date TEXT,
    inspection_conditions TEXT,
    nda_required INTEGER DEFAULT 0,
    nda_body TEXT,
    contract_body TEXT,
    currency TEXT DEFAULT 'jpy',
    contract_status TEXT DEFAULT 'draft', -- 'draft' | 'awaiting_payment' | 'active' | 'completed' | 'cancelled'
    payment_status TEXT DEFAULT 'unpaid', -- 'unpaid' | 'paid' | 'transferred' | 'refunded'
    contract_version INTEGER DEFAULT 1,
    stripe_payment_id TEXT,
    stripe_connected_account_id TEXT,
    stripe_transfer_id TEXT,
    organization_agreed_at DATETIME,
    individual_agreed_at DATETIME,
    paid_at DATETIME,
    contract_started_at DATETIME,
    service_completed_at DATETIME,
    individual_payment_at DATETIME,
    chat_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_contract_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    contract_version INTEGER NOT NULL,
    changed_by_user_id INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    change_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_contract_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 項目29: 料金・収益モデル・プラン用テーブル群
  CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'light' | 'standard' | 'enterprise'
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT DEFAULT 'active', -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS ai_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    feature TEXT NOT NULL, -- 'ai_vision' | 'ai_image' | 'ai_suggestion'
    usage_count INTEGER DEFAULT 0,
    period_start TEXT NOT NULL, -- YYYY-MM
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, feature, period_start)
  );

  CREATE TABLE IF NOT EXISTS connected_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stripe_account_id TEXT NOT NULL,
    onboarding_status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'restricted'
    charges_enabled BOOLEAN DEFAULT 0,
    payouts_enabled BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS platform_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_type TEXT NOT NULL, -- 'project_contract' | 'store_purchase' | 'buyout' | 'subscription'
    payer_id INTEGER NOT NULL,
    recipient_id INTEGER,
    item_id INTEGER,
    gross_amount INTEGER NOT NULL,
    platform_fee_rate REAL DEFAULT 0.0,
    platform_fee_amount INTEGER DEFAULT 0,
    net_amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'jpy',
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    stripe_transfer_id TEXT,
    status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'failed' | 'refunded'
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 自治体・法人向け契約・請求書・見積書管理テーブル
  CREATE TABLE IF NOT EXISTS billing_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    document_type TEXT NOT NULL DEFAULT 'invoice', -- 'quote' (見積書) | 'invoice' (請求書) | 'receipt' (領収書)
    title TEXT NOT NULL,
    target_plan TEXT NOT NULL, -- 'basic' | 'standard' | 'enterprise' | 'pro' | 'light'
    billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly'
    payment_method TEXT NOT NULL DEFAULT 'invoice', -- 'credit_card' | 'invoice' | 'bank_transfer'
    amount INTEGER NOT NULL,
    tax_amount INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued', -- 'draft' | 'issued' | 'paid' | 'overdue' | 'canceled'
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_department TEXT,
    recipient_email TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contract_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_type TEXT NOT NULL, -- 'municipality' | 'corporate' | 'individual'
    target_plan TEXT NOT NULL, -- 'standard' | 'enterprise'
    billing_cycle TEXT NOT NULL DEFAULT 'yearly', -- 'monthly' | 'yearly'
    payment_method TEXT NOT NULL DEFAULT 'invoice', -- 'credit_card' | 'invoice' | 'bank_transfer'
    request_type TEXT NOT NULL, -- 'quote' | 'invoice_payment' | 'contract_consultation' | 'annual_contract'
    org_name TEXT NOT NULL,
    department TEXT,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    custom_notes TEXT,
    status TEXT DEFAULT 'pending', -- 'pending' | 'in_review' | 'quote_sent' | 'contract_issued' | 'approved' | 'rejected'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

try { db.exec("ALTER TABLE user_subscriptions ADD COLUMN billing_cycle TEXT DEFAULT 'monthly'"); } catch(e) {}
try { db.exec("ALTER TABLE user_subscriptions ADD COLUMN payment_method_type TEXT DEFAULT 'credit_card'"); } catch(e) {}
try { db.exec("ALTER TABLE user_subscriptions ADD COLUMN contract_status TEXT DEFAULT 'active'"); } catch(e) {}

try { db.exec("ALTER TABLE project_contracts ADD COLUMN organization_total_amount REAL DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE project_contracts ADD COLUMN requires_offplatform_procedure INTEGER DEFAULT 0"); } catch(e) {}

try { db.exec("ALTER TABLE scouts ADD COLUMN nda_snapshot_title TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN nda_snapshot_body TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN nda_snapshot_version INTEGER DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN nda_snapshot_hash TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN outsourcing_snapshot_title TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN outsourcing_snapshot_body TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN outsourcing_snapshot_version INTEGER DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN outsourcing_snapshot_hash TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN attached_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN attached_by_user_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN attached_by_user_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN revision_type TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN revision_target_clause TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN revision_comment TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE scouts ADD COLUMN revision_requested_at DATETIME"); } catch (e) {}

// Add latest_idea_id to projects if it doesn't exist
try {
  db.exec(`
    DELETE FROM idea_follows
    WHERE (project_id IS NOT NULL AND follower_id IN (SELECT author_id FROM projects WHERE id = idea_follows.project_id))
       OR (idea_id IS NOT NULL AND follower_id IN (SELECT author_id FROM ideas WHERE id = idea_follows.idea_id));
  `);
} catch (e) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN latest_idea_id INTEGER");
} catch(e) {}
try {
  db.exec("ALTER TABLE projects ADD COLUMN latest_idea_at DATETIME");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN private_profile BOOLEAN DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN show_activity_status BOOLEAN DEFAULT 1");
} catch (e) {}

try {
  db.exec("ALTER TABLE ideas ADD COLUMN is_recruitment BOOLEAN DEFAULT 0");
} catch (e) {
  // column might already exist
}

try {
  db.exec("ALTER TABLE projects ADD COLUMN is_recruitment BOOLEAN DEFAULT 0");
} catch (e) {
  // column might already exist
}

// Reset recruitment EMAs created without quote to public so they show in Recruitment section
try {
  db.exec("UPDATE projects SET is_private = 0 WHERE is_recruitment = 1 AND quoted_item_id IS NULL AND (permitted_users = '[]' OR permitted_users IS NULL OR permitted_users = '' OR permitted_users LIKE '[\"' || author_id || '\"]' OR permitted_users LIKE '[' || author_id || ']')");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN title TEXT");
} catch (e) {}

try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch (e) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN password TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'individual'"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN is_account_type_selected BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN verification_token TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN org_plan TEXT DEFAULT 'basic'"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN scout_setting TEXT DEFAULT 'all'"); } catch (e) {}

try { db.exec("ALTER TABLE users ADD COLUMN country TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN region TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN organization_id INTEGER"); } catch (e) {}

try { db.exec("UPDATE users SET account_type = 'corporate' WHERE account_type = 'organization'"); } catch (e) {}

try { db.exec("ALTER TABLE users ADD COLUMN municipality_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN prefecture TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN municipality_type TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN website_url TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN department_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN department TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN official_website TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN verification_status TEXT DEFAULT 'verified'"); } catch (e) {}

try { db.exec("ALTER TABLE users ADD COLUMN company_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN industry TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN company_location TEXT"); } catch (e) {}


try {
  db.exec("ALTER TABLE projects ADD COLUMN tags TEXT DEFAULT '[]'");
} catch (e) {}

try { db.exec("ALTER TABLE projects ADD COLUMN completed_tags TEXT DEFAULT '[]'"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN is_buyout BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN is_buyout BOOLEAN DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE ideas ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN buyout_price INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN buyout_price INTEGER DEFAULT 0"); } catch (e) {}

try {
  db.exec("ALTER TABLE ideas ADD COLUMN tags TEXT DEFAULT '[]'");
} catch (e) {}

// Stripe columns
try { db.exec("ALTER TABLE users ADD COLUMN stripe_account_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN funding_goal INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN funding_current INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN funding_tiers TEXT DEFAULT '[]'"); } catch (e) {}

// Ideas columns & migrations
try { db.exec("ALTER TABLE ideas ADD COLUMN version INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN updated_at DATETIME"); } catch(e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN proposed_type TEXT DEFAULT 'revision'"); } catch(e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN remand_reason TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN remand_changes TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE ideas ADD COLUMN remand_notes TEXT"); } catch(e) {}
try { db.exec("UPDATE ideas SET updated_at = created_at WHERE updated_at IS NULL"); } catch(e) {}

// Replace old avataaars avatars with adventurer avatars
try {
  db.prepare(`UPDATE users SET avatar = replace(avatar, 'avataaars', 'adventurer') WHERE avatar LIKE '%avataaars%'`).run();
} catch (e) {
  console.error('Failed to update avatars:', e);
}

// Seed initial data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, avatar) VALUES (?, ?)');
  insertUser.run('Alice', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alice');
  insertUser.run('Bob', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bob');
  insertUser.run('Charlie', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie');
  insertUser.run('OpenAI', 'https://api.dicebear.com/7.x/adventurer/svg?seed=OpenAI');

  const insertIdea = db.prepare('INSERT INTO ideas (title, description, image, author_id, stage) VALUES (?, ?, ?, ?, ?)');
  insertIdea.run(
    'Eco-friendly Packaging',
    'A new way to package goods using biodegradable mycelium.',
    'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=800&h=1200&fit=crop&q=80',
    1,
    6
  );
  insertIdea.run(
    'AI Personal Tutor',
    'An AI that adapts to your learning style and helps you master any subject.',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=1200&fit=crop&q=80',
    2,
    4
  );
  insertIdea.run(
    'Urban Vertical Farming',
    'Transforming abandoned city buildings into high-yield vertical farms.',
    'https://images.unsplash.com/photo-1530836369250-ef71a3f5e481?w=800&h=1200&fit=crop&q=80',
    1,
    3
  );
  insertIdea.run(
    'Decentralized Social Network',
    'A social network where users own their data and algorithms are transparent.',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=1200&fit=crop&q=80',
    3,
    2
  );
  insertIdea.run(
    'AI地域共創プラットフォーム',
    '【AI地域共創プラットフォーム】<br/>地域の課題（ゴミ拾い、高齢者の手伝い、イベント設営など）と、個人のスキル（プログラミング、料理、力仕事など）をAIが最適にマッチングするアプリです。<br/>参加することで「地域ポイント」が貯まり、地元の商店街で利用可能。<br/>AIが個人の成長も分析し、新しいスキルの習得もサポートします。<br/>みんなで、もっと住みやすい街を創りましょう！',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=1200&fit=crop&q=80',
    4,
    5
  );

  const insertProject = db.prepare('INSERT INTO projects (title, description, image, author_id, stage) VALUES (?, ?, ?, ?, ?)');
  insertProject.run(
    'Ocean Cleanup Initiative',
    'Looking for ideas and collaborators to build autonomous drones for ocean plastic cleanup.',
    'https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?w=800&h=1200&fit=crop&q=80',
    2,
    1
  );
  insertProject.run(
    'Smart City Traffic Optimization',
    'City council seeking AI solutions to reduce traffic congestion during rush hours.',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=1200&fit=crop&q=80',
    3,
    3
  );
}

try {
  // Fix any stuck notifications
  db.prepare(`
    UPDATE notifications 
    SET follow_id = (
      SELECT id FROM idea_follows 
      WHERE idea_follows.project_id = notifications.item_id 
        AND idea_follows.follower_id = notifications.from_user_id
    ) 
    WHERE type = 'follow_request' 
      AND item_type = 'project' 
      AND follow_id IS NULL
  `).run();
} catch (err) {
  console.log('Migration error:', err);
}
  };

  try {
    setupDb();
  } catch (err: any) {
    if (err?.code === 'SQLITE_CORRUPT' || err?.message?.includes('malformed') || err?.message?.includes('corrupt')) {
      console.error('SQLite database corruption detected. Preserving damaged database before re-creating...');
      if (db?.open) db.close();
      if (fsLib.existsSync(DB_FILE)) {
        fsLib.renameSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
      }
      setupDb();
    } else {
      throw err;
    }
  }



  setInterval(backupIfChanged, 60 * 1000); // 1 minute periodic backups

// Periodic check for ended auctions
setInterval(() => {
  try {
    const activeAuctions = db.prepare('SELECT * FROM buyouts WHERE status = \'active\' AND buyout_type = \'auction\' AND end_date IS NOT NULL').all() as any[];
    const now = new Date();
    
    for (const buyout of activeAuctions) {
      if (new Date(buyout.end_date) <= now) {
        // Complete the auction
        const highestBid = db.prepare('SELECT user_id, amount FROM auction_bids WHERE buyout_id = ? ORDER BY amount DESC LIMIT 1').get(buyout.id) as any;
        
        const winner_id = highestBid ? highestBid.user_id : null;
        const winning_price = highestBid ? highestBid.amount : null;
        
        db.prepare('UPDATE buyouts SET winner_id = ?, winning_price = ?, status = ? WHERE id = ?').run(
          winner_id, winning_price, 'completed', buyout.id
        );
        
        if (highestBid) {
          db.prepare('INSERT OR IGNORE INTO buyout_applications (buyout_id, user_id, price, status) VALUES (?, ?, ?, ?)').run(
            buyout.id, highestBid.user_id, highestBid.amount, 'selected'
          );
          db.prepare('UPDATE buyout_applications SET status = ? WHERE buyout_id = ? AND user_id = ?').run('selected', buyout.id, highestBid.user_id);
          
          db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(
            highestBid.user_id, 'buyout_won', buyout.creator_id, buyout.id, 'buyout'
          );
          io.to(`user:${highestBid.user_id}`).emit('notification');
        }
        
        // Notify creator
        db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(
          buyout.creator_id, 'auction_ended', winner_id || buyout.creator_id, buyout.id, 'buyout'
        );
        io.to(`user:${buyout.creator_id}`).emit('notification');
        
        // Notify all other participants
        const participants = db.prepare('SELECT DISTINCT user_id FROM buyout_applications WHERE buyout_id = ?').all(buyout.id) as any[];
        const bidParticipants = db.prepare('SELECT DISTINCT user_id FROM auction_bids WHERE buyout_id = ?').all(buyout.id) as any[];
        const allParticipants = new Set([...participants.map((p: any) => p.user_id), ...bidParticipants.map((p: any) => p.user_id)]);
        
        allParticipants.delete(buyout.creator_id);
        if (winner_id) allParticipants.delete(winner_id);
        
        for (const pId of allParticipants) {
          db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(
            pId, 'auction_ended', buyout.creator_id, buyout.id, 'buyout'
          );
          io.to(`user:${pId}`).emit('notification');
        }
      }
    }
  } catch (e) {
    console.error('Error checking ended auctions:', e);
  }
}, 10000);

  
  runProposalMigration();

  // Do an initial backup after boot just in case it's the first time
  setTimeout(backupSQLiteToFirestore, 10000);
}

// API Routes
app.use('/api', (req, res, next) => {
  const originalJson = res.json;
  res.json = function(body) {
    const userId = req.query.user_id || req.query.current_user_id || (req.method === 'POST' ? req.body.author_id : null);
    
    function filterItem(item) {
        if (!item || typeof item !== 'object') return true;
        if (!('is_private' in item)) return true; // ignore items that don't have is_private field
        if (!item.is_private) return true;
        if (userId && item.author_id == userId) return true;
        try {
            const permitted = JSON.parse(item.permitted_users || '[]');
            if (userId && permitted.includes(parseInt(userId))) return true;
        } catch(e) {}
        return false;
    }
    
    if (Array.isArray(body)) {
       body = body.filter(filterItem);
    } else if (body && typeof body === 'object') {
       if (body.users && body.items && Array.isArray(body.items)) {
           body.items = body.items.filter(filterItem);
       } else if (body.id && body.author_id && ('is_private' in body)) {
           if (!filterItem(body)) {
               res.status(403);
               body = { error: 'Access denied: this is a private item.' };
           }
       }
    }
    
    return originalJson.call(this, body);
  };
  next();
});


// Helper to check if user exists
const userExists = (id: any) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  return !!user;
};

const getRootProject = (quoted_item_id: number, quoted_item_type: string) => {
  let currId = quoted_item_id;
  let currType = quoted_item_type;
  
  while (currType === 'idea' && currId) {
     const idea = db.prepare('SELECT quoted_item_id, quoted_item_type FROM ideas WHERE id = ?').get(currId) as any;
     if (!idea || !idea.quoted_item_id) return null;
     currId = idea.quoted_item_id;
     currType = idea.quoted_item_type;
  }
  
  if (currType === 'project') return currId;
  return null;
}

const isProjectMember = (projectId: number, userId: number | null) => {
  if (!userId || !projectId) return false;
  const p = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(projectId) as any;
  if (p && p.author_id == userId) return true;
  const f = db.prepare('SELECT is_mutual FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(projectId, userId) as any;
  if (f && f.is_mutual === 1) return true;
  const m = db.prepare('SELECT 1 FROM messages WHERE project_id = ? AND user_id = ?').get(projectId, userId) as any;
  if (m) return true;
  return false;
};

function runProposalMigration() {
  try {
    const proposalMsgs = db.prepare("SELECT id, idea_id, project_id FROM messages WHERE type = 'edit_proposal' AND idea_id IS NOT NULL").all() as any[];
    for (const msg of proposalMsgs) {
      if (msg.idea_id) {
        const rootP = getRootProject(msg.idea_id, 'idea');
        if (rootP) {
          db.prepare('UPDATE messages SET project_id = ?, idea_id = NULL WHERE id = ?').run(rootP, msg.id);
        }
      }
    }
  } catch (e) {
    console.error("Migration error for proposal messages:", e);
  }
}

const ensureSubscription = (subscriber_id: number, subscribed_to_id: number) => {
  if (subscriber_id === subscribed_to_id) return;
  try {
    db.prepare('INSERT OR IGNORE INTO subscriptions (subscriber_id, subscribed_to_id) VALUES (?, ?)').run(subscriber_id, subscribed_to_id);
  } catch (e) {
    // Ignore errors
  }
};

// Get all users
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

// Get user profile with stats
app.get('/api/users/:id', (req, res) => {
  const user_id = req.params.id;
  const current_user_id = req.query.current_user_id;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const subscriberCount = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE subscribed_to_id = ?').get(user_id) as any;
  const followingCount = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE subscriber_id = ?').get(user_id) as any;
  const ideaCount = db.prepare('SELECT COUNT(*) as count FROM ideas WHERE author_id = ?').get(user_id) as any;
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects WHERE author_id = ?').get(user_id) as any;
  const jointCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM idea_follows 
    WHERE follower_id = ? AND is_mutual = 1
    AND (
      (idea_id IS NOT NULL AND EXISTS (SELECT 1 FROM ideas WHERE id = idea_follows.idea_id))
      OR 
      (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects WHERE id = idea_follows.project_id))
    )
  `).get(user_id) as any;

  const ratingStats = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(rating) as rating_count FROM ratings WHERE to_user_id = ?').get(user_id) as any;

  let isSubscribed = false;
  let isFollowingMe = false;
  if (current_user_id) {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE subscriber_id = ? AND subscribed_to_id = ?').get(current_user_id, user_id);
    isSubscribed = !!sub;
    
    const subMe = db.prepare('SELECT * FROM subscriptions WHERE subscriber_id = ? AND subscribed_to_id = ?').get(user_id, current_user_id);
    isFollowingMe = !!subMe;
  }

  res.json({
    ...user,
    subscriberCount: subscriberCount.count,
    followingCount: followingCount.count,
    ideaCount: ideaCount.count,
    projectCount: projectCount.count,
    jointCount: jointCount.count,
    isSubscribed,
    isFollowingMe,
    avg_rating: ratingStats?.avg_rating || 0,
    rating_count: ratingStats?.rating_count || 0
  });
});

// Get total unread count for a user
app.get('/api/users/:id/unread_count', (req, res) => {
  const user_id = req.params.id;
  if (!userExists(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }
  try {
    const result = db.prepare(`
      WITH user_chats AS (
          SELECT id, 'idea' as type FROM ideas WHERE author_id = ?
          UNION
          SELECT idea_id as id, 'idea' as type FROM idea_follows WHERE follower_id = ? AND is_mutual = 1 AND idea_id IS NOT NULL
          UNION
          SELECT id, 'project' as type FROM projects WHERE author_id = ?
          UNION
          SELECT project_id as id, 'project' as type FROM idea_follows WHERE follower_id = ? AND is_mutual = 1 AND project_id IS NOT NULL
          UNION
          SELECT project_id as id, 'project' as type FROM messages WHERE user_id = ? AND project_id IS NOT NULL
          UNION
          SELECT idea_id as id, 'idea' as type FROM messages WHERE user_id = ? AND idea_id IS NOT NULL
      )
      SELECT 
        SUM(CASE WHEN uc.id IS NOT NULL THEN 1 ELSE 0 END) as project_count,
        SUM(CASE WHEN m.recipient_id = ? THEN 1 ELSE 0 END) as direct_count
      FROM messages m
      LEFT JOIN user_chats uc ON (
          (uc.type = 'idea' AND m.idea_id = uc.id) OR
          (uc.type = 'project' AND m.project_id = uc.id)
      )
      WHERE (uc.id IS NOT NULL OR m.recipient_id = ?)
      AND m.user_id != ?
      AND NOT EXISTS (
          SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?
      )
    `).get(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id) as any;
    
    res.json({ 
      unread_count: (result?.project_count || 0) + (result?.direct_count || 0),
      project_unread_count: result?.project_count || 0,
      direct_unread_count: result?.direct_count || 0
    });
  } catch (e) {
    console.error('Error fetching unread count:', e);
    res.status(500).json({ error: 'Failed to fetch unread count', unread_count: 0, project_unread_count: 0, direct_unread_count: 0 });
  }
});

// Get unread notifications count
app.get('/api/users/:id/unread_notifications_count', (req, res) => {
  const user_id = req.params.id;
  if (!userExists(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(user_id) as any;
    res.json({ count: result?.count || 0 });
  } catch (e) {
    console.error('Error fetching unread notifications count:', e);
    res.status(500).json({ error: 'Failed to fetch unread notifications count', count: 0 });
  }
});

// Get unread offers count
app.get('/api/users/:id/unread_offer_count', (req, res) => {
  const user_id = req.params.id;
  if (!userExists(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }
  try {
    const result = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND type = 'offer' AND is_read = 0").get(user_id) as any;
    res.json({ count: result?.count || 0 });
  } catch (e) {
    console.error('Error fetching unread offer count:', e);
    res.status(500).json({ error: 'Failed to fetch unread offer count', count: 0 });
  }
});

// Get unread recruitment count
app.get('/api/users/:id/unread_recruitment_count', (req, res) => {
  const user_id = req.params.id;
  if (!userExists(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }
  try {
    const pCount = db.prepare(`
      SELECT COUNT(i.id) as count
      FROM ideas i
      JOIN users u ON i.author_id = u.id
      JOIN projects p ON i.quoted_item_id = p.id AND i.quoted_item_type = 'project'
      WHERE p.author_id = ? AND p.is_recruitment = 1 AND u.account_type = 'individual'
        AND NOT EXISTS (SELECT 1 FROM idea_reads ir WHERE ir.idea_id = i.id AND ir.user_id = ?)
    `).get(user_id, user_id) as any;

    const iCount = db.prepare(`
      SELECT COUNT(i.id) as count
      FROM ideas i
      JOIN users u ON i.author_id = u.id
      JOIN ideas ri ON i.quoted_item_id = ri.id AND i.quoted_item_type = 'idea'
      WHERE ri.author_id = ? AND ri.is_recruitment = 1 AND u.account_type = 'individual'
        AND NOT EXISTS (SELECT 1 FROM idea_reads ir WHERE ir.idea_id = i.id AND ir.user_id = ?)
    `).get(user_id, user_id) as any;

    const total = (pCount?.count || 0) + (iCount?.count || 0);
    res.json({ count: total });
  } catch (e) {
    console.error('Error fetching unread recruitment count:', e);
    res.status(500).json({ error: 'Failed to fetch unread recruitment count', count: 0 });
  }
});

// Get recruitment EMAs posted by this organization user (or submitted to by individual user) with unread ideas count
app.get('/api/users/:id/recruitment_my_emas', (req, res) => {
  const user_id = req.params.id;
  if (!userExists(user_id)) {
    return res.status(404).json({ error: 'User not found' });
  }
  try {
    const userObj = db.prepare('SELECT account_type FROM users WHERE id = ?').get(user_id) as any;
    const isOrg = userObj?.account_type === 'organization';

    if (isOrg) {
      const projects = db.prepare(`
        SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type,
               COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage,
               projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, projects.tags, projects.completed_tags,
               latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
               strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
               (SELECT username FROM users WHERE id = author_id) as author_name,
               (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
               (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
               (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
               (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
               (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count,
               (SELECT COUNT(*) FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project') as quotes_count,
               (
                 SELECT COUNT(i.id) FROM ideas i
                 JOIN users u ON i.author_id = u.id
                 WHERE i.quoted_item_id = projects.id AND i.quoted_item_type = 'project' AND u.account_type = 'individual'
                   AND NOT EXISTS (SELECT 1 FROM idea_reads ir WHERE ir.idea_id = i.id AND ir.user_id = ?)
               ) as unread_ideas_count
        FROM projects
        WHERE author_id = ? AND is_recruitment = 1
        ORDER BY created_at DESC
      `).all(user_id, user_id) as any[];

      const ideas = db.prepare(`
        SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type,
               COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), ideas.stage) as stage,
               ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, ideas.tags, NULL as completed_tags,
               'idea' as type, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
               (SELECT username FROM users WHERE id = author_id) as author_name,
               (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
               (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
               (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
               (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
               (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count,
               (SELECT COUNT(*) FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea') as quotes_count,
               (
                 SELECT COUNT(i.id) FROM ideas i
                 JOIN users u ON i.author_id = u.id
                 WHERE i.quoted_item_id = ideas.id AND i.quoted_item_type = 'idea' AND u.account_type = 'individual'
                   AND NOT EXISTS (SELECT 1 FROM idea_reads ir WHERE ir.idea_id = i.id AND ir.user_id = ?)
               ) as unread_ideas_count
        FROM ideas
        WHERE author_id = ? AND is_recruitment = 1
        ORDER BY created_at DESC
      `).all(user_id, user_id) as any[];

      res.json([...projects, ...ideas]);
    } else {
      const projects = db.prepare(`
        SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type,
               COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage,
               projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, projects.tags, projects.completed_tags,
               latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
               strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
               (SELECT username FROM users WHERE id = author_id) as author_name,
               (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
               (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
               (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
               (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
               (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count,
               (SELECT COUNT(*) FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project') as quotes_count,
               0 as unread_ideas_count
        FROM projects
        WHERE is_recruitment = 1 AND id IN (SELECT quoted_item_id FROM ideas WHERE author_id = ? AND quoted_item_type = 'project')
        ORDER BY created_at DESC
      `).all(user_id) as any[];

      const ideas = db.prepare(`
        SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type,
               COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), ideas.stage) as stage,
               ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, ideas.tags, NULL as completed_tags,
               'idea' as type, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
               (SELECT username FROM users WHERE id = author_id) as author_name,
               (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
               (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
               (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
               (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
               (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count,
               (SELECT COUNT(*) FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea') as quotes_count,
               0 as unread_ideas_count
        FROM ideas
        WHERE is_recruitment = 1 AND id IN (SELECT quoted_item_id FROM ideas WHERE author_id = ? AND quoted_item_type = 'idea')
        ORDER BY created_at DESC
      `).all(user_id) as any[];

      res.json([...projects, ...ideas]);
    }
  } catch (e) {
    console.error('Error fetching my recruitment emas:', e);
    res.status(500).json({ error: 'Failed to fetch my recruitment emas' });
  }
});

// Get user store sales and revenue
app.get('/api/users/:id/store_revenue', (req, res) => {
  const user_id = req.params.id;
  if (!userExists(user_id)) {
    return res.status(404).json({ error: 'User not found', total_revenue: 0, formatted: '¥0' });
  }
  try {
    const projectSales = db.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as total, COUNT(p.id) as count
      FROM purchases p
      JOIN projects pr ON p.project_id = pr.id
      WHERE pr.author_id = ? AND p.status = 'completed'
    `).get(user_id) as any;

    const buyoutSales = db.prepare(`
      SELECT COALESCE(SUM(b.winning_price), 0) as total, COUNT(b.id) as count
      FROM buyouts b
      WHERE b.creator_id = ? AND b.status = 'paid'
    `).get(user_id) as any;

    const totalRevenue = (projectSales?.total || 0) + (buyoutSales?.total || 0);
    const totalCount = (projectSales?.count || 0) + (buyoutSales?.count || 0);

    res.json({
      total_revenue: totalRevenue,
      sales_count: totalCount,
      formatted: `¥${totalRevenue.toLocaleString()}`
    });
  } catch (e) {
    console.error('Error fetching user store revenue:', e);
    res.status(500).json({ error: 'Failed to fetch store revenue', total_revenue: 0, formatted: '¥0' });
  }
});

// Subscribe to a user
app.post('/api/users/:id/subscribe', (req, res) => {
  const subscribed_to_id = req.params.id;
  const { subscriber_id } = req.body;

  if (!userExists(subscriber_id) || !userExists(subscribed_to_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  try {
    db.prepare('INSERT INTO subscriptions (subscriber_id, subscribed_to_id) VALUES (?, ?)').run(subscriber_id, subscribed_to_id);
    
    db.prepare('INSERT INTO notifications (user_id, type, from_user_id) VALUES (?, ?, ?)').run(subscribed_to_id, 'new_follower', subscriber_id);
    io.to(`user:${subscribed_to_id}`).emit('notification', { type: 'new_follower', from_user_id: subscriber_id });

    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Already subscribed' });
  }
});

// Unsubscribe from a user
app.post('/api/users/:id/unsubscribe', (req, res) => {
  const subscribed_to_id = req.params.id;
  const { subscriber_id } = req.body;

  db.prepare('DELETE FROM subscriptions WHERE subscriber_id = ? AND subscribed_to_id = ?').run(subscriber_id, subscribed_to_id);
  res.json({ success: true });
});

// Get user subscriptions
app.get('/api/users/:id/subscriptions', (req, res) => {
  const user_id = req.params.id;
  const subs = db.prepare(`
    SELECT users.*
    FROM subscriptions
    JOIN users ON subscriptions.subscribed_to_id = users.id
    WHERE subscriptions.subscriber_id = ?
    ORDER BY subscriptions.created_at DESC
  `).all(user_id);
  res.json(subs);
});

// Get user subscribers
app.get('/api/users/:id/subscribers', (req, res) => {
  const user_id = req.params.id;
  const subs = db.prepare(`
    SELECT users.*
    FROM subscriptions
    JOIN users ON subscriptions.subscriber_id = users.id
    WHERE subscriptions.subscribed_to_id = ?
    ORDER BY subscriptions.created_at DESC
  `).all(user_id);
  res.json(subs);
});

// Get user joint items (ideas/projects with mutual follows)
app.get('/api/users/:id/joint', (req, res) => {
  const user_id = req.params.id;
  try {
    const jointItems = db.prepare(`
      SELECT ideas.id, ideas.title, ideas.image, COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), ideas.stage) as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, NULL as latest_idea_id, NULL as latest_idea_at, 'idea' as type, 
             strftime('%Y-%m-%dT%H:%M:%SZ', idea_follows.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count,
           (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 0 AND status = 'pending') as pending_approvals_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM idea_follows
      JOIN ideas ON idea_follows.idea_id = ideas.id
      JOIN users ON ideas.author_id = users.id
      WHERE idea_follows.follower_id = ? AND idea_follows.is_mutual = 1
      UNION ALL
      SELECT projects.id, projects.title, projects.image, COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type, 
             strftime('%Y-%m-%dT%H:%M:%SZ', idea_follows.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count,
           (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 0 AND status = 'pending') as pending_approvals_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM idea_follows
      JOIN projects ON idea_follows.project_id = projects.id
      JOIN users ON projects.author_id = users.id
      WHERE idea_follows.follower_id = ? AND idea_follows.is_mutual = 1
      ORDER BY created_at DESC
    `).all(user_id, user_id);
    res.json(jointItems);
  } catch (e) {
    console.error('Error fetching joint items:', e);
    res.status(500).json({ error: 'Failed to fetch joint items' });
  }
});

app.post('/api/register', (req, res) => {
  const { email, password, username, account_type } = req.body;
  if (!email || !password || !username || !account_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if email or username exists
  const existingEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existingEmail) return res.status(400).json({ error: 'Email already exists' });
  
  const existingUsername = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (existingUsername) return res.status(400).json({ error: 'Username already exists' });

  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  try {
    const info = db.prepare('INSERT INTO users (email, password, username, account_type, is_account_type_selected, is_verified, verification_token, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      email, password, username, account_type, 1, 0, token, `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
    );
    res.json({ success: true, message: 'Verification text sent', token }); 
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  let user = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(token) as any;
  if (!user) return res.status(400).json({ error: 'Invalid token' });

  db.prepare('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?').run(user.id);
  user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json(user);
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  let user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;
  
  if (!user) {
    // Attempt fallback to username for legacy users or login by username instead of email
    user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(email, password);
  }

  if (!user) {
    // If it's a legacy user hitting old mock login where we didn't specify password but they log in? 
    // Usually they'd fail login. Let's return error.
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_verified && user.email) {
    return res.status(403).json({ error: 'Please verify your email first' });
  }

  res.json(user);
});

app.post('/api/login/username', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    // Create the user if it doesn't exist
    const stmt = db.prepare(`
      INSERT INTO users (username, title, account_type, is_account_type_selected, is_verified, avatar)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(username, '', 'individual', 1, 1, `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as any;
  }
  
  res.json(user);
});

app.get('/api/auth/google/url', (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `https://${host}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    access_type: 'offline',
    prompt: 'consent'
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `https://${host}/api/auth/google/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    
    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(userData.email) as any;
    if (!user) {
      // Create user
      const info = db.prepare('INSERT INTO users (email, username, account_type, is_verified, avatar) VALUES (?, ?, ?, ?, ?)').run(
        userData.email,
        userData.name ? userData.name.replace(/\s+/g, '_') : userData.email.split('@')[0], // Use name as username fallback
        'individual',
        1, // Google verified
        userData.picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.email}`
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else {
      // Auto-verify if they weren't verified before
      if (!user.is_verified) {
         db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(user.id);
         user.is_verified = 1;
      }
    }

    // Return HTML to postMessage to parent window
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(user)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Update user settings
app.put('/api/users/:id/settings', (req, res) => {
  const user_id = req.params.id;
  const { private_profile, show_activity_status, account_type, is_account_type_selected, org_plan, country, region } = req.body;
  
  if (private_profile !== undefined) {
    db.prepare('UPDATE users SET private_profile = ? WHERE id = ?').run(private_profile ? 1 : 0, user_id);
  }
  if (show_activity_status !== undefined) {
    db.prepare('UPDATE users SET show_activity_status = ? WHERE id = ?').run(show_activity_status ? 1 : 0, user_id);
  }
  if (account_type !== undefined) {
    const normalizedType = account_type === 'organization' ? 'corporate' : account_type;
    db.prepare('UPDATE users SET account_type = ? WHERE id = ?').run(normalizedType, user_id);
  }
  if (is_account_type_selected !== undefined) {
    db.prepare('UPDATE users SET is_account_type_selected = ? WHERE id = ?').run(is_account_type_selected ? 1 : 0, user_id);
  }
  if (org_plan !== undefined) {
    db.prepare('UPDATE users SET org_plan = ? WHERE id = ?').run(org_plan, user_id);
  }
  if (country !== undefined) {
    db.prepare('UPDATE users SET country = ? WHERE id = ?').run(country, user_id);
  }
  if (region !== undefined) {
    db.prepare('UPDATE users SET region = ? WHERE id = ?').run(region, user_id);
  }
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  res.json(user);
});

// Update user profile
app.put('/api/users/:id/profile', (req, res) => {
  const user_id = req.params.id;
  const { 
    username, title, tags, org_plan, account_type,
    municipality_name, prefecture, municipality_type, website_url, official_website, department_name, department, verification_status,
    company_name, industry, company_location
  } = req.body;
  
  try {
    if (username) {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, user_id);
    }
    if (account_type !== undefined) {
      const normalizedType = account_type === 'organization' ? 'corporate' : account_type;
      db.prepare('UPDATE users SET account_type = ? WHERE id = ?').run(normalizedType, user_id);
    }
    if (title !== undefined) {
      db.prepare('UPDATE users SET title = ? WHERE id = ?').run(title, user_id);
    }
    if (org_plan !== undefined) {
      db.prepare("UPDATE users SET org_plan = ? WHERE id = ?").run(org_plan, user_id);
    }
    if (tags !== undefined) {
      db.prepare('UPDATE users SET tags = ? WHERE id = ?').run(tags, user_id);
    }
    if (municipality_name !== undefined) {
      db.prepare('UPDATE users SET municipality_name = ? WHERE id = ?').run(municipality_name, user_id);
    }
    if (prefecture !== undefined) {
      db.prepare('UPDATE users SET prefecture = ? WHERE id = ?').run(prefecture, user_id);
    }
    if (municipality_type !== undefined) {
      db.prepare('UPDATE users SET municipality_type = ? WHERE id = ?').run(municipality_type, user_id);
    }
    if (website_url !== undefined || official_website !== undefined) {
      const site = official_website !== undefined ? official_website : website_url;
      db.prepare('UPDATE users SET website_url = ?, official_website = ? WHERE id = ?').run(site, site, user_id);
    }
    if (department_name !== undefined || department !== undefined) {
      const dept = department !== undefined ? department : department_name;
      db.prepare('UPDATE users SET department_name = ?, department = ? WHERE id = ?').run(dept, dept, user_id);
    }
    if (verification_status !== undefined) {
      db.prepare('UPDATE users SET verification_status = ? WHERE id = ?').run(verification_status, user_id);
    }
    if (company_name !== undefined) {
      db.prepare('UPDATE users SET company_name = ? WHERE id = ?').run(company_name, user_id);
    }
    if (industry !== undefined) {
      db.prepare('UPDATE users SET industry = ? WHERE id = ?').run(industry, user_id);
    }
    if (company_location !== undefined) {
      db.prepare('UPDATE users SET company_location = ? WHERE id = ?').run(company_location, user_id);
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    res.json(user);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Update user avatar
app.put('/api/users/:id/avatar', (req, res) => {
  const user_id = req.params.id;
  const { avatar } = req.body;
  
  if (!avatar) {
    return res.status(400).json({ error: 'Avatar is required' });
  }

  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, user_id);
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  res.json(updatedUser);
});

// Like an item
app.post('/api/likes', (req, res) => {
  const { user_id, item_id, item_type } = req.body;
  
  if (!userExists(user_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  try {
    db.prepare('INSERT INTO likes (user_id, item_id, item_type) VALUES (?, ?, ?)').run(user_id, item_id, item_type);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Already liked' });
  }
});

// Unlike an item
app.delete('/api/likes', (req, res) => {
  const { user_id, item_id, item_type } = req.body;
  db.prepare('DELETE FROM likes WHERE user_id = ? AND item_id = ? AND item_type = ?').run(user_id, item_id, item_type);
  res.json({ success: true });
});

// Check if liked
app.get('/api/likes/check', (req, res) => {
  const { user_id, item_id, item_type } = req.query;
  const like = db.prepare('SELECT * FROM likes WHERE user_id = ? AND item_id = ? AND item_type = ?').get(user_id, item_id, item_type);
  res.json({ liked: !!like });
});

// Get like count
app.get('/api/likes/count', (req, res) => {
  const { item_id, item_type } = req.query;
  const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE item_id = ? AND item_type = ?').get(item_id, item_type) as any;
  res.json({ count: count.count });
});

// Archive an item
app.post('/api/archives', (req, res) => {
  const { user_id, item_id, item_type } = req.body;
  
  if (!userExists(user_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  try {
    db.prepare('INSERT INTO archives (user_id, item_id, item_type) VALUES (?, ?, ?)').run(user_id, item_id, item_type);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Already archived' });
  }
});

// Unarchive an item
app.delete('/api/archives', (req, res) => {
  const { user_id, item_id, item_type } = req.body;
  db.prepare('DELETE FROM archives WHERE user_id = ? AND item_id = ? AND item_type = ?').run(user_id, item_id, item_type);
  res.json({ success: true });
});

// Check if archived
app.get('/api/archives/check', (req, res) => {
  const { user_id, item_id, item_type } = req.query;
  const archive = db.prepare('SELECT * FROM archives WHERE user_id = ? AND item_id = ? AND item_type = ?').get(user_id, item_id, item_type);
  res.json({ archived: !!archive });
});

// Get archive count
app.get('/api/archives/count', (req, res) => {
  const { item_id, item_type } = req.query;
  const count = db.prepare('SELECT COUNT(*) as count FROM archives WHERE item_id = ? AND item_type = ?').get(item_id, item_type) as any;
  res.json({ count: count.count });
});

// Record a view
app.post('/api/views', (req, res) => {
  const { user_id, item_id, item_type } = req.body;
  
  if (user_id && !userExists(user_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  db.prepare('INSERT INTO views (user_id, item_id, item_type) VALUES (?, ?, ?)').run(user_id, item_id, item_type);
  res.json({ success: true });
});


// Get region recommended EMA (ideas + projects)
app.get('/api/ideas/region_recommended', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json([]);
  
  const user = db.prepare('SELECT country, region FROM users WHERE id = ?').get(user_id) as { country: string, region: string } | undefined;
  if (!user || !user.country || !user.region) return res.json([]);

  const items = db.prepare(`
    SELECT * FROM (
      SELECT id, title, description, image, author_id, quoted_item_id, quoted_item_type, COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage, is_recruitment, is_private, permitted_users, status, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
             strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
             (SELECT username FROM users WHERE id = author_id) as author_name,
             (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
               WITH RECURSIVE idea_tree AS (
                 SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
                 UNION ALL
                 SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
               )
               SELECT COUNT(*) FROM idea_tree
             ) as quotes_count,
             (
               (SELECT COUNT(*) FROM likes l JOIN users u ON l.user_id = u.id WHERE l.item_id = projects.id AND l.item_type = 'project' AND u.country = ? AND u.region = ?) * 2 +
               (SELECT COUNT(*) FROM archives a JOIN users u ON a.user_id = u.id WHERE a.item_id = projects.id AND a.item_type = 'project' AND u.country = ? AND u.region = ?) * 3 +
               (SELECT COUNT(*) FROM idea_follows f JOIN users u ON f.follower_id = u.id WHERE f.project_id = projects.id AND u.country = ? AND u.region = ?) * 4 +
               (SELECT COUNT(*) FROM views v JOIN users u ON v.user_id = u.id WHERE v.item_id = projects.id AND v.item_type = 'project' AND u.country = ? AND u.region = ?) * 1
             ) as region_score
      FROM projects
      WHERE is_private = 0 AND status = 'active'
      UNION ALL
      SELECT id, title, description, image, author_id, quoted_item_id, quoted_item_type, COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), ideas.stage) as stage, is_recruitment, is_private, permitted_users, 'active' as status, NULL as latest_idea_id, NULL as latest_idea_at, 'idea' as type,
             strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
             (SELECT username FROM users WHERE id = author_id) as author_name,
             (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
             (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
               WITH RECURSIVE idea_tree AS (
                 SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
                 UNION ALL
                 SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
               )
               SELECT COUNT(*) FROM idea_tree
             ) as quotes_count,
             (
               (SELECT COUNT(*) FROM likes l JOIN users u ON l.user_id = u.id WHERE l.item_id = ideas.id AND l.item_type = 'idea' AND u.country = ? AND u.region = ?) * 2 +
               (SELECT COUNT(*) FROM archives a JOIN users u ON a.user_id = u.id WHERE a.item_id = ideas.id AND a.item_type = 'idea' AND u.country = ? AND u.region = ?) * 3 +
               (SELECT COUNT(*) FROM idea_follows f JOIN users u ON f.follower_id = u.id WHERE f.idea_id = ideas.id AND u.country = ? AND u.region = ?) * 4 +
               (SELECT COUNT(*) FROM views v JOIN users u ON v.user_id = u.id WHERE v.item_id = ideas.id AND v.item_type = 'idea' AND u.country = ? AND u.region = ?) * 1
             ) as region_score
      FROM ideas
      WHERE is_private = 0 AND status = 'active'
    )
    WHERE region_score > 0 AND author_id != ?
    ORDER BY region_score DESC, created_at DESC
    LIMIT 20
  `).all(
    user.country, user.region, user.country, user.region, user.country, user.region, user.country, user.region,
    user.country, user.region, user.country, user.region, user.country, user.region, user.country, user.region,
    user_id
  );
  
  res.json(items);
});

// Get recommended ideas and projects (including recently viewed related)
app.get('/api/ideas/recommended', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    const items = db.prepare(`
      SELECT id, title, description, image, author_id, quoted_item_id, quoted_item_type, COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage, is_recruitment, is_private, permitted_users, status, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
             strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
             (SELECT username FROM users WHERE id = author_id) as author_name,
             (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM projects
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    return res.json(items);
  }

  // Logic: Subscribed authors first, then recently viewed related, then others
  const items = db.prepare(`
    SELECT DISTINCT id, title, description, image, author_id, quoted_item_id, quoted_item_type, stage, is_recruitment, is_private, permitted_users, latest_idea_id, latest_idea_at, type,
           created_at, author_name, author_avatar, likes_count, comments_count, follows_count, quotes_count,
           MAX(priority) as priority
    FROM (
      SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.completed_title, projects.completed_description, projects.completed_images, projects.author_id, projects.quoted_item_id, projects.quoted_item_type, COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
             strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count,
             CASE WHEN subscriptions.id IS NOT NULL THEN 2 
                  WHEN views.id IS NOT NULL THEN 1 
                  ELSE 0 END as priority
      FROM projects
      JOIN users ON projects.author_id = users.id
      LEFT JOIN subscriptions ON subscriptions.subscriber_id = ? AND subscriptions.subscribed_to_id = projects.author_id
      LEFT JOIN views ON views.user_id = ? AND views.item_id = projects.id AND views.item_type = 'project'
      WHERE projects.status = 'active'
    )
    GROUP BY id, type
    ORDER BY priority DESC, created_at DESC
    LIMIT 20
  `).all(user_id, user_id);
  
  res.json(items);
});

app.get('/api/users/:id/likes', (req, res) => {
  const { id } = req.params;
  try {
    const items = db.prepare(`
      SELECT 
        l.item_id as id,
        l.item_type as type,
        CASE WHEN l.item_type = 'project' THEN p.title ELSE i.title END as title,
        CASE WHEN l.item_type = 'project' THEN p.image ELSE i.image END as image,
        CASE WHEN l.item_type = 'project' THEN p.created_at ELSE i.created_at END as created_at,
        CASE WHEN l.item_type = 'project' THEN p.is_private ELSE i.is_private END as is_private,
        CASE WHEN l.item_type = 'project' THEN p.permitted_users ELSE i.permitted_users END as permitted_users,
        CASE WHEN l.item_type = 'project' THEN p.is_private ELSE i.is_private END as is_private,
        CASE WHEN l.item_type = 'project' THEN p.permitted_users ELSE i.permitted_users END as permitted_users,
        CASE WHEN l.item_type = 'project' THEN p.author_id ELSE i.author_id END as author_id,
        u.username as author_name,
        u.avatar as author_avatar
      FROM likes l
      LEFT JOIN projects p ON l.item_type = 'project' AND l.item_id = p.id
      LEFT JOIN ideas i ON l.item_type = 'idea' AND l.item_id = i.id
      LEFT JOIN users u ON CASE WHEN l.item_type = 'project' THEN p.author_id ELSE i.author_id END = u.id
      WHERE l.user_id = ? AND (p.id IS NOT NULL OR i.id IS NOT NULL)
      ORDER BY l.created_at DESC
    `).all(id);
    res.json(items);
  } catch (e) {
    console.error('Error fetching liked items:', e);
    res.status(500).json({ error: 'Failed to fetch liked items' });
  }
});

app.get('/api/users/:id/archives', (req, res) => {
  const { id } = req.params;
  try {
    const items = db.prepare(`
      SELECT 
        l.item_id as id,
        l.item_type as type,
        CASE WHEN l.item_type = 'project' THEN p.title ELSE i.title END as title,
        CASE WHEN l.item_type = 'project' THEN p.image ELSE i.image END as image,
        CASE WHEN l.item_type = 'project' THEN p.created_at ELSE i.created_at END as created_at,
        CASE WHEN l.item_type = 'project' THEN p.author_id ELSE i.author_id END as author_id,
        u.username as author_name,
        u.avatar as author_avatar
      FROM archives l
      LEFT JOIN projects p ON l.item_type = 'project' AND l.item_id = p.id
      LEFT JOIN ideas i ON l.item_type = 'idea' AND l.item_id = i.id
      LEFT JOIN users u ON CASE WHEN l.item_type = 'project' THEN p.author_id ELSE i.author_id END = u.id
      WHERE l.user_id = ? AND (p.id IS NOT NULL OR i.id IS NOT NULL)
      ORDER BY l.created_at DESC
    `).all(id);
    res.json(items);
  } catch (e) {
    console.error('Error fetching archived items:', e);
    res.status(500).json({ error: 'Failed to fetch archived items' });
  }
});

app.get('/api/users/:id/comments', (req, res) => {
  const { id } = req.params;
  try {
    const items = db.prepare(`
      SELECT 
        c.id as comment_id,
        c.content,
        c.created_at,
        i.id as idea_id,
        i.title as idea_title,
        i.is_private,
        i.permitted_users,
        iu.username as idea_author_name,
        p.id as project_id,
        p.title as project_title,
        p.is_private,
        p.permitted_users,
        pu.username as project_author_name
      FROM comments c
      LEFT JOIN ideas i ON c.idea_id = i.id
      LEFT JOIN projects p ON c.project_id = p.id
      LEFT JOIN users iu ON i.author_id = iu.id
      LEFT JOIN users pu ON p.author_id = pu.id
      WHERE c.user_id = ? AND (p.id IS NOT NULL OR i.id IS NOT NULL)
      ORDER BY c.created_at DESC
    `).all(id);
    res.json(items);
  } catch (e) {
    console.error('Error fetching comments:', e);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get ideas by author
app.get('/api/users/:id/ideas', (req, res) => {
  const ideas = db.prepare(`
    SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), ideas.stage) as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users,
           NULL as latest_idea_id, NULL as latest_idea_at, 'idea' as type,
           strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
           (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
    FROM ideas
    JOIN users ON ideas.author_id = users.id
    WHERE ideas.author_id = ? AND ideas.status = 'active'
    ORDER BY ideas.created_at DESC
  `).all(req.params.id);
  res.json(ideas);
});

// Get projects by author
app.get('/api/users/:id/projects', (req, res) => {
  const projects = db.prepare(`
    SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.completed_title, projects.completed_description, projects.completed_images, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type, COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type,
           strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
           (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
    FROM projects
    JOIN users ON projects.author_id = users.id
    WHERE projects.author_id = ?
    ORDER BY projects.created_at DESC
  `).all(req.params.id);
  res.json(projects);
});

// Get all EMA (Ideas + Projects) by author
app.get('/api/users/:id/ema', (req, res) => {
  try {
    const emaItems = db.prepare(`
      SELECT ideas.id, ideas.title, ideas.image, COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), ideas.stage) as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, NULL as latest_idea_id, NULL as latest_idea_at, 'idea' as type, 
             strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM ideas
      JOIN users ON ideas.author_id = users.id
      WHERE ideas.author_id = ? AND ideas.status = 'active'
      UNION ALL
      SELECT projects.id, projects.title, projects.image, COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at, 'project' as type, 
             strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM projects
      JOIN users ON projects.author_id = users.id
      WHERE projects.author_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id, req.params.id, req.params.id);
    res.json(emaItems);
  } catch (e) {
    console.error('Error fetching ema items:', e);
    res.status(500).json({ error: 'Failed to fetch ema items' });
  }
});

// Get lineage (path from root to current item)
app.get('/api/lineage/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const user_id = req.query.user_id ? Number(req.query.user_id) : null;
  const lineage = [];
  let currentId = id;
  let currentType = type;

  // 1. Fetch ancestors
  const visitedAncestors = new Set<string>();
  while (currentId) {
    const key = `${currentType}:${currentId}`;
    if (visitedAncestors.has(key)) {
      console.warn(`[Lineage Cycle Avoided] Ancestor cycle detected at ${key}`);
      break;
    }
    visitedAncestors.add(key);

    const table = currentType === 'idea' ? 'ideas' : 'projects';
    const item = db.prepare(`
      SELECT id, title, description, author_id, quoted_item_id, quoted_item_type, image, COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ${table}.id AND se.item_type = '${currentType}'), stage) as stage, is_recruitment, is_private, permitted_users,
             ${currentType === 'project' ? 'status, images,' : 'NULL as status, NULL as images,'}
             strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
             (SELECT username FROM users WHERE id = author_id) as author_name,
             (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
             (SELECT COUNT(*) FROM likes WHERE item_id = ${table}.id AND item_type = '${currentType}') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE ${currentType}_id = ${table}.id) as comments_count
      FROM ${table} WHERE id = ?
    `).get(currentId) as any;

    if (!item) break;
    
    // Check privacy for ancestors
    if (item.is_private === 1 && item.author_id !== user_id) {
      let isPermitted = false;
      try {
        const permitted = JSON.parse(item.permitted_users || '[]');
        if (permitted.includes(user_id)) isPermitted = true;
      } catch(e) {}
      if (!isPermitted) break;
    }

    lineage.unshift({ ...item, type: currentType });
    currentId = item.quoted_item_id;
    currentType = item.quoted_item_type;
  }

  // 2. Fetch descendants
  const visitedDescendants = new Set<string>();
  const fetchDescendants = (parentId: number, parentType: string) => {
    const key = `${parentType}:${parentId}`;
    if (visitedDescendants.has(key)) {
      console.warn(`[Lineage Cycle Avoided] Descendant cycle detected at ${key}`);
      return;
    }
    visitedDescendants.add(key);

    const childIdeas = db.prepare(`
      SELECT id, title, description, author_id, quoted_item_id, quoted_item_type, image, COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), stage) as stage, is_recruitment, is_private, permitted_users, NULL as status, NULL as images,
           strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
           (SELECT username FROM users WHERE id = author_id) as author_name,
           (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
           (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
           'idea' as type
      FROM ideas 
      WHERE quoted_item_id = ? AND quoted_item_type = ? AND status = 'active'
    `).all(parentId, parentType) as any[];

    const childProjects = db.prepare(`
      SELECT id, title, description, author_id, quoted_item_id, quoted_item_type, image, COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), stage) as stage, is_recruitment, is_private, permitted_users, status, images,
           strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
           (SELECT username FROM users WHERE id = author_id) as author_name,
           (SELECT avatar FROM users WHERE id = author_id) as author_avatar,
           (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
           'project' as type
      FROM projects 
      WHERE quoted_item_id = ? AND quoted_item_type = ?
    `).all(parentId, parentType) as any[];

    const children = [...childIdeas, ...childProjects].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const child of children) {
      let isPermitted = true;
      if (child.is_private === 1 && child.author_id !== user_id) {
        isPermitted = false;
        try {
          const permitted = JSON.parse(child.permitted_users || '[]');
          if (permitted.includes(user_id)) isPermitted = true;
        } catch(e) {}
      }
      
      if (isPermitted) {
        lineage.push(child);
        fetchDescendants(child.id, child.type);
      }
    }
  };

  if (lineage.length > 0) {
    fetchDescendants(Number(id), type);
  }

  res.json(lineage);
});

// Get all ideas

app.post('/api/ideas/:id/approve_proposal', (req, res) => {
  const proposalId = req.params.id;
  const { messageId, approver_id } = req.body || {};
  try {
    const proposal = db.prepare("SELECT * FROM ideas WHERE id = ?").get(proposalId) as any;
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const approver = approver_id ? db.prepare("SELECT username FROM users WHERE id = ?").get(approver_id) as any : null;
    const approverName = approver ? approver.username : 'EMA管理者';

    let activeIdeaId = Number(proposalId);
    let newVersionNumber = 1;

    if (proposal.quoted_item_id && proposal.quoted_item_type === 'idea' && proposal.proposed_type !== 'branch') {
      // Edit Revision of existing IDEA
      const targetIdeaId = proposal.quoted_item_id;
      const targetIdea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(targetIdeaId) as any;

      if (targetIdea) {
        activeIdeaId = targetIdea.id;
        const oldVer = targetIdea.version || 1;
        newVersionNumber = oldVer + 1;

        // Archive previous active version in idea_versions
        db.prepare(`
          INSERT INTO idea_versions (idea_id, version, title, description, image, author_id, proposer_id, approver_id, change_reason, created_at, approved_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'archived')
        `).run(
          targetIdea.id,
          oldVer,
          targetIdea.title,
          targetIdea.description,
          targetIdea.image,
          targetIdea.author_id,
          proposal.author_id,
          approver_id || targetIdea.author_id,
          '編集承認前の保存',
          targetIdea.created_at
        );

        // Update target active IDEA
        db.prepare(`
          UPDATE ideas 
          SET title = ?, description = ?, image = ?, stage = ?, version = ?, updated_at = CURRENT_TIMESTAMP, status = 'active'
          WHERE id = ?
        `).run(
          proposal.title,
          proposal.description,
          proposal.image,
          proposal.stage || targetIdea.stage,
          newVersionNumber,
          targetIdea.id
        );

        // Record new active version
        db.prepare(`
          INSERT INTO idea_versions (idea_id, version, title, description, image, author_id, proposer_id, approver_id, change_reason, created_at, approved_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'active')
        `).run(
          targetIdea.id,
          newVersionNumber,
          proposal.title,
          proposal.description,
          proposal.image,
          targetIdea.author_id,
          proposal.author_id,
          approver_id || targetIdea.author_id,
          '編集提案の承認適用'
        );

        // Mark proposal status
        db.prepare("UPDATE ideas SET status = 'approved' WHERE id = ?").run(proposalId);

        // Send chat notification
        let rootP = getRootProject(proposal.quoted_item_id, proposal.quoted_item_type);
        if (!rootP && proposal.quoted_item_type === 'project') rootP = proposal.quoted_item_id;

        const room = rootP ? `project:${rootP}` : `${proposal.quoted_item_type}:${proposal.quoted_item_id}`;
        const chatNotice = `IDEAの編集提案が承認されました\n\n対象IDEA：${targetIdea.title}\n承認者：${approverName}\n新しいバージョン：v${newVersionNumber}`;
        const meta = JSON.stringify({
          type: 'proposal_approval_notice',
          idea_id: targetIdea.id,
          title: targetIdea.title,
          approver_name: approverName,
          version: `v${newVersionNumber}`,
          status: 'approved'
        });
        const idea_id = rootP ? null : (proposal.quoted_item_type === 'idea' ? proposal.quoted_item_id : null);
        const project_id = rootP || (proposal.quoted_item_type === 'project' ? proposal.quoted_item_id : null);
        const msgInfo = db.prepare('INSERT INTO messages (idea_id, project_id, user_id, type, content, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(
          idea_id, project_id, approver_id || proposal.author_id, 'proposal_approval_notice', chatNotice, meta
        );
        const msgIdNew = msgInfo.lastInsertRowid;
        const msgObj = db.prepare('SELECT m.*, u.username, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?').get(msgIdNew);
        io.to(room).emit('new_message', msgObj);

        // Notify proposer
        db.prepare("INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, message) VALUES (?, 'proposal_approved', ?, ?, 'idea', 'あなたの編集提案が承認されました')").run(
          proposal.author_id, approver_id || 1, targetIdea.id
        );
      }
    } else {
      // New IDEA or Branch proposal
      db.prepare("UPDATE ideas SET status = 'active', version = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(proposalId);
      db.prepare(`
        INSERT INTO idea_versions (idea_id, version, title, description, image, author_id, proposer_id, approver_id, change_reason, created_at, approved_at, status)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, '初回提案承認', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'active')
      `).run(
        proposalId,
        proposal.title,
        proposal.description,
        proposal.image,
        proposal.author_id,
        proposal.author_id,
        approver_id || proposal.author_id
      );

      if (proposal.quoted_item_id && proposal.quoted_item_type) {
        const room = `${proposal.quoted_item_type}:${proposal.quoted_item_id}`;
        const chatNotice = `新規IDEAの提案が承認されました\n\n対象IDEA：${proposal.title}\n承認者：${approverName}\n新しいバージョン：v1`;
        const meta = JSON.stringify({
          type: 'proposal_approval_notice',
          idea_id: proposalId,
          title: proposal.title,
          approver_name: approverName,
          version: 'v1',
          status: 'approved'
        });
        const idea_id = proposal.quoted_item_type === 'idea' ? proposal.quoted_item_id : null;
        const project_id = proposal.quoted_item_type === 'project' ? proposal.quoted_item_id : null;
        const msgInfo = db.prepare('INSERT INTO messages (idea_id, project_id, user_id, type, content, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(
          idea_id, project_id, approver_id || proposal.author_id, 'proposal_approval_notice', chatNotice, meta
        );
        const msgIdNew = msgInfo.lastInsertRowid;
        const msgObj = db.prepare('SELECT m.*, u.username, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?').get(msgIdNew);
        io.to(room).emit('new_message', msgObj);
      }

      db.prepare("INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, message) VALUES (?, 'proposal_approved', ?, ?, 'idea', 'あなたの新規IDEA提案が承認されました')").run(
        proposal.author_id, approver_id || 1, proposalId
      );
    }

    if (messageId) {
      const msg = db.prepare("SELECT metadata FROM messages WHERE id = ?").get(messageId) as any;
      if (msg && msg.metadata) {
        let meta = JSON.parse(msg.metadata);
        meta.status = 'approved';
        db.prepare("UPDATE messages SET metadata = ? WHERE id = ?").run(JSON.stringify(meta), messageId);
      }
    }

    res.json({ success: true, activeIdeaId, version: newVersionNumber });
  } catch(e) {
    console.error("Approve proposal error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ideas/:id/reject_proposal', (req, res) => {
  const proposalId = req.params.id;
  const { messageId, approver_id, reason = '', requested_changes = '', notes = '' } = req.body || {};
  try {
    const proposal = db.prepare("SELECT * FROM ideas WHERE id = ?").get(proposalId) as any;
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    db.prepare("UPDATE ideas SET status = 'remanded', remand_reason = ?, remand_changes = ?, remand_notes = ? WHERE id = ?").run(
      reason, requested_changes, notes, proposalId
    );

    if (messageId) {
      const msg = db.prepare("SELECT metadata FROM messages WHERE id = ?").get(messageId) as any;
      if (msg && msg.metadata) {
        let meta = JSON.parse(msg.metadata);
        meta.status = 'remanded';
        meta.reason = reason;
        meta.requested_changes = requested_changes;
        meta.notes = notes;
        db.prepare("UPDATE messages SET metadata = ? WHERE id = ?").run(JSON.stringify(meta), messageId);
      }
    }

    if (proposal.quoted_item_id && proposal.quoted_item_type) {
      let rootP = getRootProject(proposal.quoted_item_id, proposal.quoted_item_type);
      if (!rootP && proposal.quoted_item_type === 'project') rootP = proposal.quoted_item_id;

      const room = rootP ? `project:${rootP}` : `${proposal.quoted_item_type}:${proposal.quoted_item_id}`;
      const chatNotice = `IDEAの編集提案が差し戻されました\n\n対象IDEA：${proposal.title}\n差し戻し理由：\n${reason}${requested_changes ? `\n\n修正希望内容：\n${requested_changes}` : ''}`;
      const meta = JSON.stringify({
        type: 'proposal_remand_notice',
        proposal_id: proposalId,
        proposal_title: proposal.title,
        reason,
        requested_changes,
        notes,
        status: 'remanded'
      });
      const idea_id = rootP ? null : (proposal.quoted_item_type === 'idea' ? proposal.quoted_item_id : null);
      const project_id = rootP || (proposal.quoted_item_type === 'project' ? proposal.quoted_item_id : null);
      const msgInfo = db.prepare('INSERT INTO messages (idea_id, project_id, user_id, type, content, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(
        idea_id, project_id, approver_id || proposal.author_id, 'proposal_remand_notice', chatNotice, meta
      );
      const msgIdNew = msgInfo.lastInsertRowid;
      const msgObj = db.prepare('SELECT m.*, u.username, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?').get(msgIdNew);
      io.to(room).emit('new_message', msgObj);
    }

    db.prepare("INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, message) VALUES (?, 'proposal_rejected', ?, ?, 'idea', '提案が差し戻されました。確認して修正・再提出ができます。')").run(
      proposal.author_id, approver_id || 1, proposalId
    );

    res.json({ success: true });
  } catch(e) {
    console.error("Reject proposal error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ideas/:id/versions', (req, res) => {
  const ideaId = req.params.id;
  try {
    const versions = db.prepare(`
      SELECT iv.*, 
             u1.username as author_name, u1.avatar as author_avatar,
             u2.username as proposer_name, u2.avatar as proposer_avatar,
             u3.username as approver_name, u3.avatar as approver_avatar
      FROM idea_versions iv
      LEFT JOIN users u1 ON iv.author_id = u1.id
      LEFT JOIN users u2 ON iv.proposer_id = u2.id
      LEFT JOIN users u3 ON iv.approver_id = u3.id
      WHERE iv.idea_id = ?
      ORDER BY iv.version DESC
    `).all(ideaId);
    res.json(versions);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ideas', (req, res) => {
  const { search, user_id } = req.query;
  let ideas;
  
  if (search) {
    ideas = db.prepare(`
      SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, ideas.stage as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, ideas.tags, ideas.version, strftime('%Y-%m-%dT%H:%M:%SZ', ideas.updated_at) as updated_at, ideas.proposed_type, ideas.remand_reason, ideas.remand_changes, ideas.remand_notes,
             strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM ideas
      JOIN users ON ideas.author_id = users.id
      WHERE (ideas.title LIKE ? OR ideas.description LIKE ? OR users.username LIKE ?) AND ideas.status = 'active'
      AND NOT EXISTS (
        WITH RECURSIVE lineage AS (
          SELECT id, quoted_item_id, quoted_item_type FROM ideas AS i2 WHERE i2.id = ideas.id
          UNION ALL
          SELECT l.id, i3.quoted_item_id, i3.quoted_item_type FROM ideas i3 JOIN lineage l ON i3.id = l.quoted_item_id AND l.quoted_item_type = 'idea'
        )
        SELECT 1 FROM lineage l JOIN projects p ON l.quoted_item_id = p.id AND l.quoted_item_type = 'project' WHERE p.status = 'completed'
      )
      ORDER BY ideas.created_at DESC
    `).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else if (user_id) {
    // Recommendation logic: Prioritize subscribed users, then others
    ideas = db.prepare(`
      SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, ideas.stage as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, ideas.tags, ideas.version, strftime('%Y-%m-%dT%H:%M:%SZ', ideas.updated_at) as updated_at, ideas.proposed_type, ideas.remand_reason, ideas.remand_changes, ideas.remand_notes,
             strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count,
             CASE WHEN subscriptions.id IS NOT NULL THEN 1 ELSE 0 END as is_subscribed
      FROM ideas
      JOIN users ON ideas.author_id = users.id
      LEFT JOIN subscriptions ON subscriptions.subscriber_id = ? AND subscriptions.subscribed_to_id = ideas.author_id
      WHERE ideas.status = 'active' AND NOT EXISTS (
        WITH RECURSIVE lineage AS (
          SELECT id, quoted_item_id, quoted_item_type FROM ideas AS i2 WHERE i2.id = ideas.id
          UNION ALL
          SELECT l.id, i3.quoted_item_id, i3.quoted_item_type FROM ideas i3 JOIN lineage l ON i3.id = l.quoted_item_id AND l.quoted_item_type = 'idea'
        )
        SELECT 1 FROM lineage l JOIN projects p ON l.quoted_item_id = p.id AND l.quoted_item_type = 'project' WHERE p.status = 'completed'
      )
      ORDER BY is_subscribed DESC, ideas.created_at DESC
    `).all(user_id);
  } else {
    ideas = db.prepare(`
      SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, ideas.stage as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, ideas.tags, ideas.version, strftime('%Y-%m-%dT%H:%M:%SZ', ideas.updated_at) as updated_at, ideas.proposed_type, ideas.remand_reason, ideas.remand_changes, ideas.remand_notes,
             strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM ideas
      JOIN users ON ideas.author_id = users.id
      WHERE ideas.status = 'active' AND NOT EXISTS (
        WITH RECURSIVE lineage AS (
          SELECT id, quoted_item_id, quoted_item_type FROM ideas AS i2 WHERE i2.id = ideas.id
          UNION ALL
          SELECT l.id, i3.quoted_item_id, i3.quoted_item_type FROM ideas i3 JOIN lineage l ON i3.id = l.quoted_item_id AND l.quoted_item_type = 'idea'
        )
        SELECT 1 FROM lineage l JOIN projects p ON l.quoted_item_id = p.id AND l.quoted_item_type = 'project' WHERE p.status = 'completed'
      )
      ORDER BY ideas.created_at DESC
    `).all();
  }
  res.json(ideas);
});

// Get all projects
app.get('/api/projects', (req, res) => {
  const { search } = req.query;
  let projects;
  if (search) {
    projects = db.prepare(`
      SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.completed_title, projects.completed_description, projects.completed_images, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type, projects.stage as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, projects.tags, projects.completed_tags, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at,
             strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM projects
      JOIN users ON projects.author_id = users.id
      WHERE (projects.title LIKE ? OR projects.description LIKE ? OR users.username LIKE ?) AND projects.status = 'active'
      ORDER BY projects.created_at DESC
    `).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    projects = db.prepare(`
      SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.completed_title, projects.completed_description, projects.completed_images, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type, projects.stage as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, projects.tags, projects.completed_tags, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at,
             strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
             (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
             (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
             (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
      FROM projects
      JOIN users ON projects.author_id = users.id
      WHERE projects.status = 'active'
      ORDER BY projects.created_at DESC
    `).all();
  }
  res.json(projects);
});

// Unified Search
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json({ users: [], items: [] });
  }

  const query = `%${q}%`;

  const users = db.prepare(`
    SELECT id, username, avatar
    FROM users
    WHERE username LIKE ?
    LIMIT 20
  `).all(query);

  const projects = db.prepare(`
    SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.completed_title, projects.completed_description, projects.completed_images, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type, projects.stage as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, projects.tags, projects.completed_tags, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at,
           'project' as item_type,
           strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
           (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
    FROM projects
    JOIN users ON projects.author_id = users.id
    WHERE (projects.title LIKE ? OR projects.description LIKE ? OR projects.completed_title LIKE ? OR projects.completed_description LIKE ? OR projects.tags LIKE ? OR projects.completed_tags LIKE ? OR users.username LIKE ?)
    ORDER BY projects.created_at DESC
  `).all(query, query, query, query, query, query, query) as any[];

  const ideas = db.prepare(`
    SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, ideas.stage as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, ideas.tags,
           'idea' as item_type,
           (
             WITH RECURSIVE root_path AS (
               SELECT id, quoted_item_id, quoted_item_type FROM ideas i2 WHERE i2.id = ideas.id
               UNION ALL
               SELECT i.id, i.quoted_item_id, i.quoted_item_type FROM ideas i
               JOIN root_path rp ON rp.quoted_item_id = i.id AND rp.quoted_item_type = 'idea'
             )
             SELECT p.status FROM root_path rp
             JOIN projects p ON rp.quoted_item_id = p.id AND rp.quoted_item_type = 'project'
             LIMIT 1
           ) as status,
           strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
           (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
    FROM ideas
    JOIN users ON ideas.author_id = users.id
    WHERE (ideas.title LIKE ? OR ideas.description LIKE ? OR ideas.tags LIKE ? OR users.username LIKE ?) AND ideas.status = 'active'
    ORDER BY ideas.created_at DESC
  `).all(query, query, query, query) as any[];

  const items = [...projects, ...ideas].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Calculate status based on root project
  for (const item of items) {
    if (item.quoted_item_id) {
      let currentId = item.quoted_item_id;
      let currentType = item.quoted_item_type;
      while (true) {
        if (currentType === 'idea') {
          const parent = db.prepare('SELECT quoted_item_id, quoted_item_type FROM ideas WHERE id = ?').get(currentId) as any;
          if (parent && parent.quoted_item_id) {
            currentId = parent.quoted_item_id;
            currentType = parent.quoted_item_type;
          } else {
            break;
          }
        } else if (currentType === 'project') {
          const parent = db.prepare('SELECT quoted_item_id, quoted_item_type FROM projects WHERE id = ?').get(currentId) as any;
          if (parent && parent.quoted_item_id) {
            currentId = parent.quoted_item_id;
            currentType = parent.quoted_item_type;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      if (currentType === 'project' && currentId) {
        const rootProject = db.prepare('SELECT status FROM projects WHERE id = ?').get(currentId) as any;
        if (rootProject) {
          item.status = rootProject.status;
        }
      }
    }
  }

  res.json({ users, items });
});

app.get('/api/tags/trending', (req, res) => {
  const projects = db.prepare('SELECT tags, completed_tags FROM projects').all() as any[];
  const ideas = db.prepare('SELECT tags FROM ideas').all() as any[];

  const INDUSTRIES_JA = [
    "水産・農林業", "鉱業", "建設業", "食料品", "繊維製品", "パルプ・紙", "化学", "医薬品",
    "石油・石炭製品", "ゴム製品", "ガラス・土石製品", "鉄鋼", "非鉄金属", "金属製品", "機械",
    "電気機器", "輸送用機器", "精密機器", "その他製品", "電気・ガス業", "陸運業", "海運業",
    "空運業", "倉庫・運輸関連業", "情報・通信", "卸売業", "小売業", "銀行業", "証券業",
    "保険業", "その他金融業", "不動産業", "サービス業"
  ];
  const INDUSTRIES_EN = [
    "Agriculture & Forestry", "Mining", "Construction", "Foods", "Textiles", "Pulp & Paper", "Chemicals", "Pharmaceuticals",
    "Oil & Coal", "Rubber", "Glass & Ceramics", "Iron & Steel", "Nonferrous Metals", "Metal Products", "Machinery",
    "Electric Appliances", "Transportation Eq.", "Precision Inst.", "Other Products", "Electric & Gas", "Land Transport", "Marine Transport",
    "Air Transport", "Warehousing", "Info & Comm", "Wholesale", "Retail", "Banks", "Securities",
    "Insurance", "Other Finance", "Real Estate", "Services"
  ];

  const knownIndustryTags = [...INDUSTRIES_JA, ...INDUSTRIES_EN].map(i => '#' + i).sort((a,b) => b.length - a.length);
  const escapedIndustryTags = knownIndustryTags.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const tagExtractPattern = new RegExp(`(${escapedIndustryTags.join('|')}|#[^\\s#]+)`, 'g');

  const tagCounts: Record<string, number> = {};

  const processPostTags = (tagsText1?: string, tagsText2?: string) => {
    const uniqueTags = new Set<string>();
    
    const extractTags = (text?: string) => {
      if (!text || text === '[]') return;
      let textToParse = text;
      try {
        if (text.startsWith('[')) {
           const parsed = JSON.parse(text);
           if (Array.isArray(parsed)) {
             textToParse = parsed.join(' ');
           }
        }
      } catch(e) {}
      
      const matches = textToParse.match(tagExtractPattern);
      if (matches) {
        matches.forEach(tag => uniqueTags.add(tag));
      }
    };
    
    extractTags(tagsText1);
    extractTags(tagsText2);
    
    uniqueTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  };

  projects.forEach(p => {
    processPostTags(p.tags, p.completed_tags);
  });
  ideas.forEach(i => {
    processPostTags(i.tags);
  });

  const sortedTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json(sortedTags);
});

// Get completed projects
app.get('/api/completed', (req, res) => {
  const projects = db.prepare(`
    SELECT projects.id, COALESCE(projects.completed_title, projects.title) as title, 
           COALESCE(projects.completed_description, projects.description) as description, 
           projects.image, COALESCE(projects.completed_images, projects.images) as images, 
           projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type, projects.stage as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, projects.tags, projects.completed_tags, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at,
           projects.funding_goal, projects.funding_current, projects.funding_tiers,
           strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
           (SELECT COUNT(*) FROM views WHERE item_id = projects.id AND item_type = 'project') as views_count,
           (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count
    FROM projects
    JOIN users ON projects.author_id = users.id
    WHERE projects.status = 'completed'
    ORDER BY projects.created_at DESC
  `).all();
  res.json(projects);
});

// Complete a project
app.put('/api/projects/:id/complete', (req, res) => {
  const project_id = req.params.id;
  const { title, description, images, tags = '[]', funding_goal = 0, funding_tiers = '[]', is_buyout = false, buyout_price = 0 } = req.body;
  if (title !== undefined && description !== undefined && images !== undefined) {
    db.prepare("UPDATE projects SET status = 'completed', completed_title = ?, completed_description = ?, completed_images = ?, completed_tags = ?, funding_goal = ?, funding_tiers = ?, is_buyout = ?, buyout_price = ? WHERE id = ?").run(title, description, JSON.stringify(images), tags, funding_goal, typeof funding_tiers === 'string' ? funding_tiers : JSON.stringify(funding_tiers), is_buyout ? 1 : 0, buyout_price, project_id);
  } else {
    db.prepare("UPDATE projects SET status = 'completed' WHERE id = ?").run(project_id);
  }

  // Notify mutual followers that they can rate the author
  const project = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(project_id) as any;
  if (project) {
    const followers = db.prepare('SELECT follower_id FROM idea_follows WHERE project_id = ? AND is_mutual = 1').all(project_id) as any[];
    const notifyStmt = db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)');
    for (const f of followers) {
      notifyStmt.run(f.follower_id, 'rate_user', project.author_id, project_id, 'project');
      io.to(`user:${f.follower_id}`).emit('notification');
    }
  }
  res.json({ success: true });
});

// Follow project
app.post('/api/projects/:id/follow', (req, res) => {
  const { follower_id, reason, skills, role, period, hours, message } = req.body;
  const project_id = req.params.id;

  if (!userExists(follower_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  const existing = db.prepare('SELECT id FROM idea_follows WHERE project_id = ? AND follower_id = ? AND status != \'rejected\' AND status != \'withdrawn\' AND status != \'left\' AND status != \'removed\'').get(project_id, follower_id);
  if (existing) {
    return res.status(400).json({ error: 'Already applied or following' });
  }


  try {
    const info = db.prepare('INSERT INTO idea_follows (project_id, follower_id, reason, skills, role, period, hours, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(project_id, follower_id, reason, skills, role, period, hours, message);
    const follow = db.prepare('SELECT * FROM idea_follows WHERE id = ?').get(info.lastInsertRowid) as any;
    
    // Create notification for project author
    const project = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(project_id) as any;
    if (project && project.author_id !== follower_id) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(project.author_id, 'follow_request', follower_id, project_id, 'project', follow.id);
      
      io.to(`user:${project.author_id}`).emit('notification', {
        type: 'follow_request',
        from_user_id: follower_id,
        item_id: project_id,
        item_type: 'project',
        follow_id: follow.id
      });
    }

    res.json(follow);
  } catch (e) {
    res.status(500).json({ error: 'Failed to follow project' });
  }
});

// Get project members (mutual followers + author)
app.get('/api/projects/:id/members', (req, res) => {
  const project_id = req.params.id;
  const project = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(project_id) as any;
  if (!project) return res.json([]);

  const members = db.prepare(`
    SELECT users.id, users.username, users.avatar, users.account_type, 'follower' as role
    FROM idea_follows
    JOIN users ON idea_follows.follower_id = users.id
    WHERE idea_follows.project_id = ? AND idea_follows.is_mutual = 1 AND idea_follows.follower_id != ?
    UNION ALL
    SELECT users.id, users.username, users.avatar, users.account_type, 'author' as role
    FROM projects
    JOIN users ON projects.author_id = users.id
    WHERE projects.id = ?
  `).all(project_id, project.author_id, project_id) as any[];

  const uniqueMap = new Map<number, any>();
  for (const m of members) {
    if (!uniqueMap.has(m.id) || m.role === 'author') {
      uniqueMap.set(m.id, m);
    }
  }
  res.json(Array.from(uniqueMap.values()));
});

// Get detailed project members (Req 33)
app.get('/api/projects/:id/members_detailed', (req, res) => {
  const project_id = req.params.id;
  const project = db.prepare("SELECT author_id, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at FROM projects WHERE id = ?").get(project_id) as any;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const followers = db.prepare(`
    SELECT users.id, users.username, users.avatar, 'メンバー' as role,
           strftime('%Y-%m-%dT%H:%M:%SZ', idea_follows.created_at) as joined_at,
           COALESCE(idea_follows.role, '全般') as field,
           'オンライン' as online_status,
           '編集可' as permissions,
           COALESCE(idea_follows.reason, '参加申請') as join_route
    FROM idea_follows
    JOIN users ON idea_follows.follower_id = users.id
    WHERE idea_follows.project_id = ? AND idea_follows.is_mutual = 1 AND idea_follows.follower_id != ?
  `).all(project_id, project.author_id) as any[];

  const author = db.prepare(`
    SELECT users.id, users.username, users.avatar, '管理者' as role,
           ? as joined_at,
           'プロジェクトオーナー' as field,
           'オンライン' as online_status,
           '管理者' as permissions,
           'EMA作成者' as join_route
    FROM users WHERE id = ?
  `).get(project.created_at, project.author_id) as any;

  let result = author ? [author, ...followers] : followers;
  const seen = new Set<number>();
  result = result.filter(m => {
    if (!m || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  res.json(result);
});

// Get detailed idea members (Req 33)
app.get('/api/ideas/:id/members_detailed', (req, res) => {
  const idea_id = req.params.id;
  const idea = db.prepare("SELECT author_id, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at FROM ideas WHERE id = ?").get(idea_id) as any;
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  const followers = db.prepare(`
    SELECT users.id, users.username, users.avatar, 'メンバー' as role,
           strftime('%Y-%m-%dT%H:%M:%SZ', idea_follows.created_at) as joined_at,
           COALESCE(idea_follows.role, '全般') as field,
           'オンライン' as online_status,
           '編集可' as permissions,
           COALESCE(idea_follows.reason, '参加申請') as join_route
    FROM idea_follows
    JOIN users ON idea_follows.follower_id = users.id
    WHERE idea_follows.idea_id = ? AND idea_follows.is_mutual = 1 AND idea_follows.follower_id != ?
  `).all(idea_id, idea.author_id) as any[];

  const author = db.prepare(`
    SELECT users.id, users.username, users.avatar, '管理者' as role,
           ? as joined_at,
           'IDEA提案者' as field,
           'オンライン' as online_status,
           '管理者' as permissions,
           'IDEA作成者' as join_route
    FROM users WHERE id = ?
  `).get(idea.created_at, idea.author_id) as any;

  let result = author ? [author, ...followers] : followers;
  const seen = new Set<number>();
  result = result.filter(m => {
    if (!m || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  res.json(result);
});

// GET /api/schedules
app.get('/api/schedules', (req, res) => {
  const { project_id, idea_id, user_id } = req.query;
  if (!project_id && !idea_id) {
    return res.status(400).json({ error: 'project_id or idea_id required' });
  }

  try {
    if (project_id) {
      db.prepare(`
        UPDATE schedules 
        SET status = 'overdue' 
        WHERE (end_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) 
          AND status NOT IN ('completed')
          AND project_id = ?
      `).run(project_id);
    } else if (idea_id) {
      db.prepare(`
        UPDATE schedules 
        SET status = 'overdue' 
        WHERE (end_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) 
          AND status NOT IN ('completed')
          AND idea_id = ?
      `).run(idea_id);
    }
  } catch(e) {
    console.error(e);
  }

  let sql = `
    SELECT s.*, 
           u.username as author_name, u.avatar as author_avatar,
           au.username as assignee_name, au.avatar as assignee_avatar,
           (SELECT COUNT(*) FROM schedule_rsvps WHERE schedule_id = s.id AND status = 'attending') as attending_count,
           (SELECT COUNT(*) FROM schedule_rsvps WHERE schedule_id = s.id AND status = 'declined') as declined_count,
           (SELECT COUNT(*) FROM schedule_rsvps WHERE schedule_id = s.id AND status = 'tentative') as tentative_count,
           (SELECT status FROM schedule_rsvps WHERE schedule_id = s.id AND user_id = ?) as my_rsvp
    FROM schedules s
    JOIN users u ON s.author_id = u.id
    LEFT JOIN users au ON s.assignee_id = au.id
    WHERE 1=1
  `;
  const params: any[] = [user_id || 0];

  if (project_id) {
    sql += ' AND s.project_id = ?';
    params.push(project_id);
  }
  if (idea_id) {
    sql += ' AND s.idea_id = ?';
    params.push(idea_id);
  }

  sql += ' ORDER BY s.start_at ASC';

  const rows = db.prepare(sql).all(...params) as any[];

  const parsed = rows.map(r => ({
    ...r,
    attendees: r.attendees ? JSON.parse(r.attendees) : [],
    attachments: r.attachments ? JSON.parse(r.attachments) : [],
    reminders: r.reminders ? JSON.parse(r.reminders) : []
  }));

  res.json(parsed);
});

// GET /api/schedules/:id
app.get('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const schedule = db.prepare(`
    SELECT s.*, 
           u.username as author_name, u.avatar as author_avatar,
           au.username as assignee_name, au.avatar as assignee_avatar
    FROM schedules s
    JOIN users u ON s.author_id = u.id
    LEFT JOIN users au ON s.assignee_id = au.id
    WHERE s.id = ?
  `).get(id) as any;

  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  const rsvps = db.prepare(`
    SELECT r.user_id, r.status, r.updated_at, u.username, u.avatar
    FROM schedule_rsvps r
    JOIN users u ON r.user_id = u.id
    WHERE r.schedule_id = ?
  `).all(id);

  schedule.attendees = schedule.attendees ? JSON.parse(schedule.attendees) : [];
  schedule.attachments = schedule.attachments ? JSON.parse(schedule.attachments) : [];
  schedule.reminders = schedule.reminders ? JSON.parse(schedule.reminders) : [];
  schedule.rsvps = rsvps;

  res.json(schedule);
});

// POST /api/schedules
app.post('/api/schedules', (req, res) => {
  const {
    project_id, idea_id, author_id, title, start_at, end_at, event_type,
    is_all_day, description, location, meeting_url, assignee_id,
    attendees, related_project_id, related_idea_id, related_proposal_id,
    related_task, completion_criteria, priority, reminders, notify_target,
    visibility, attachments, recurrence, recurrence_end_date, recurrence_count,
    status, notify_chat
  } = req.body;

  if (!title || !start_at || !end_at) {
    return res.status(400).json({ error: 'Title, start_at, and end_at are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO schedules (
        project_id, idea_id, author_id, title, start_at, end_at, event_type,
        is_all_day, description, location, meeting_url, assignee_id,
        attendees, related_project_id, related_idea_id, related_proposal_id,
        related_task, completion_criteria, priority, reminders, notify_target,
        visibility, attachments, recurrence, recurrence_end_date, recurrence_count,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      project_id || null, idea_id || null, author_id || null, title, start_at, end_at, event_type || '会議',
      is_all_day ? 1 : 0, description || '', location || '', meeting_url || '', assignee_id || null,
      JSON.stringify(attendees || []), related_project_id || null, related_idea_id || null, related_proposal_id || null,
      related_task || '', completion_criteria || '', priority || 'normal', JSON.stringify(reminders || []), notify_target || 'all',
      visibility || 'all', JSON.stringify(attachments || []), recurrence || 'none', recurrence_end_date || null, recurrence_count || null,
      status || 'unstarted'
    );

    const newId = info.lastInsertRowid;

    if (author_id) {
      db.prepare('INSERT OR REPLACE INTO schedule_rsvps (schedule_id, user_id, status) VALUES (?, ?, ?)').run(newId, author_id, 'attending');
    }
    if (assignee_id && assignee_id !== author_id) {
      db.prepare('INSERT OR REPLACE INTO schedule_rsvps (schedule_id, user_id, status) VALUES (?, ?, ?)').run(newId, assignee_id, 'tentative');
    }

    // Post card message into project/idea chat if requested
    if (notify_chat !== false && (project_id || idea_id)) {
      const attendeesCount = (attendees || []).length;
      const msgContent = `新しい予定が追加されました\n\n${title}\n${start_at.slice(0, 16).replace('T', ' ')} 〜 ${end_at.slice(11, 16)}\n参加者: ${attendeesCount}名`;
      const meta = JSON.stringify({
        schedule_id: newId,
        title,
        start_at,
        end_at,
        event_type: event_type || '会議',
        attendees_count: attendeesCount,
        action: 'created'
      });

      const msgInfo = db.prepare(`
        INSERT INTO messages (project_id, idea_id, user_id, content, type, metadata)
        VALUES (?, ?, ?, ?, 'schedule_event', ?)
      `).run(project_id || null, idea_id || null, author_id, msgContent, meta);

      const createdMsg = db.prepare(`
        SELECT messages.id, messages.project_id, messages.idea_id, messages.user_id, messages.content,
               messages.type, messages.metadata, strftime('%Y-%m-%dT%H:%M:%SZ', messages.created_at) as created_at,
               users.username, users.avatar, 0 as read_count, 0 as is_read
        FROM messages JOIN users ON messages.user_id = users.id WHERE messages.id = ?
      `).get(msgInfo.lastInsertRowid);

      if (io) {
        if (project_id) io.to(`project_${project_id}`).emit('new_message', createdMsg);
        if (idea_id) io.to(`idea_${idea_id}`).emit('new_message', createdMsg);
      }
    }

    // Send notifications to target users
    let targetUserIds: number[] = [];
    if (notify_target === 'assignee' && assignee_id) {
      targetUserIds = [assignee_id];
    } else if (notify_target === 'attendees') {
      targetUserIds = attendees || [];
    } else {
      if (project_id) {
        const mems = db.prepare(`
          SELECT follower_id as uid FROM idea_follows WHERE project_id = ? AND is_mutual = 1
          UNION SELECT author_id as uid FROM projects WHERE id = ?
        `).all(project_id, project_id) as any[];
        targetUserIds = mems.map(m => m.uid);
      } else if (idea_id) {
        const mems = db.prepare(`
          SELECT follower_id as uid FROM idea_follows WHERE idea_id = ? AND is_mutual = 1
          UNION SELECT author_id as uid FROM ideas WHERE id = ?
        `).all(idea_id, idea_id) as any[];
        targetUserIds = mems.map(m => m.uid);
      }
    }

    targetUserIds.filter(uid => uid !== author_id).forEach(uid => {
      db.prepare(`
        INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, message)
        VALUES (?, 'schedule_created', ?, ?, 'schedule', ?)
      `).run(uid, author_id, newId, `新しい予定: ${title}`);
    });

    res.json({ id: newId, success: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to create schedule' });
  }
});

// PUT /api/schedules/:id
app.put('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const {
    title, start_at, end_at, event_type, is_all_day, description,
    location, meeting_url, assignee_id, attendees, related_project_id,
    related_idea_id, related_proposal_id, related_task, completion_criteria,
    priority, reminders, notify_target, visibility, attachments,
    recurrence, recurrence_end_date, recurrence_count, status,
    notify_chat, updated_by
  } = req.body;

  try {
    db.prepare(`
      UPDATE schedules
      SET title = ?, start_at = ?, end_at = ?, event_type = ?, is_all_day = ?,
          description = ?, location = ?, meeting_url = ?, assignee_id = ?,
          attendees = ?, related_project_id = ?, related_idea_id = ?,
          related_proposal_id = ?, related_task = ?, completion_criteria = ?,
          priority = ?, reminders = ?, notify_target = ?, visibility = ?,
          attachments = ?, recurrence = ?, recurrence_end_date = ?,
          recurrence_count = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, start_at, end_at, event_type, is_all_day ? 1 : 0, description,
      location, meeting_url, assignee_id || null, JSON.stringify(attendees || []),
      related_project_id || null, related_idea_id || null, related_proposal_id || null,
      related_task, completion_criteria, priority, JSON.stringify(reminders || []),
      notify_target, visibility, JSON.stringify(attachments || []), recurrence,
      recurrence_end_date || null, recurrence_count || null, status, id
    );

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;

    if (notify_chat && schedule && (schedule.project_id || schedule.idea_id)) {
      const msgContent = `予定「${title}」が変更されました`;
      const meta = JSON.stringify({
        schedule_id: id,
        title,
        start_at,
        end_at,
        event_type,
        action: 'updated'
      });

      const msgInfo = db.prepare(`
        INSERT INTO messages (project_id, idea_id, user_id, content, type, metadata)
        VALUES (?, ?, ?, ?, 'schedule_event', ?)
      `).run(schedule.project_id, schedule.idea_id, updated_by || schedule.author_id, msgContent, meta);

      const createdMsg = db.prepare(`
        SELECT messages.id, messages.project_id, messages.idea_id, messages.user_id, messages.content,
               messages.type, messages.metadata, strftime('%Y-%m-%dT%H:%M:%SZ', messages.created_at) as created_at,
               users.username, users.avatar, 0 as read_count, 0 as is_read
        FROM messages JOIN users ON messages.user_id = users.id WHERE messages.id = ?
      `).get(msgInfo.lastInsertRowid);

      if (io) {
        if (schedule.project_id) io.to(`project_${schedule.project_id}`).emit('new_message', createdMsg);
        if (schedule.idea_id) io.to(`idea_${schedule.idea_id}`).emit('new_message', createdMsg);
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to update schedule' });
  }
});

// DELETE /api/schedules/:id
app.delete('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const { notify_chat, user_id } = req.body || {};

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  if (notify_chat && (schedule.project_id || schedule.idea_id)) {
    const msgContent = `予定「${schedule.title}」が削除されました`;
    const meta = JSON.stringify({
      schedule_id: id,
      title: schedule.title,
      action: 'deleted'
    });

    const msgInfo = db.prepare(`
      INSERT INTO messages (project_id, idea_id, user_id, content, type, metadata)
      VALUES (?, ?, ?, ?, 'schedule_event', ?)
    `).run(schedule.project_id, schedule.idea_id, user_id || schedule.author_id, msgContent, meta);

    const createdMsg = db.prepare(`
      SELECT messages.id, messages.project_id, messages.idea_id, messages.user_id, messages.content,
             messages.type, messages.metadata, strftime('%Y-%m-%dT%H:%M:%SZ', messages.created_at) as created_at,
             users.username, users.avatar, 0 as read_count, 0 as is_read
      FROM messages JOIN users ON messages.user_id = users.id WHERE messages.id = ?
    `).get(msgInfo.lastInsertRowid);

    if (io) {
      if (schedule.project_id) io.to(`project_${schedule.project_id}`).emit('new_message', createdMsg);
      if (schedule.idea_id) io.to(`idea_${schedule.idea_id}`).emit('new_message', createdMsg);
    }
  }

  db.prepare('DELETE FROM schedule_rsvps WHERE schedule_id = ?').run(id);
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

  res.json({ success: true });
});

// POST /api/schedules/:id/rsvp
app.post('/api/schedules/:id/rsvp', (req, res) => {
  const { id } = req.params;
  const { user_id, status } = req.body;

  if (!user_id || !status) {
    return res.status(400).json({ error: 'user_id and status are required' });
  }

  try {
    db.prepare(`
      INSERT INTO schedule_rsvps (schedule_id, user_id, status, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(schedule_id, user_id) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
    `).run(id, user_id, status);

    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to update RSVP' });
  }
});

// Get project chat messages
app.get('/api/projects/:id/messages', (req, res) => {
  const project_id = req.params.id;
  const user_id = req.query.user_id;

  if (user_id) {
    const project = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(project_id) as any;
    if (project && project.author_id != user_id) {
      const follow = db.prepare('SELECT is_mutual, status FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(project_id, user_id) as any;
      if (!follow || follow.is_mutual !== 1 || follow.status === 'left') {
        return res.status(403).json({ error: 'プロジェクトチャットを閲覧する権限がありません。' });
      }
    }
  }

  const messages = db.prepare(`
    SELECT messages.id, messages.project_id, messages.user_id, messages.content,
           messages.type, messages.metadata,
           strftime('%Y-%m-%dT%H:%M:%SZ', messages.created_at) as created_at,
           users.username, users.avatar, users.account_type,
           (SELECT COUNT(*) FROM message_reads WHERE message_id = messages.id) as read_count,
           EXISTS (SELECT 1 FROM message_reads WHERE message_id = messages.id AND user_id = ?) as is_read
    FROM messages
    JOIN users ON messages.user_id = users.id
    WHERE project_id = ?
    ORDER BY created_at ASC
  `).all(user_id, project_id);
  res.json(messages);
});

// Leave a project
app.post('/api/projects/:id/leave', (req, res) => {
  const project_id = req.params.id;
  const user_id = req.body?.user_id || req.query?.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const project = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(project_id) as any;
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (project.author_id == user_id) {
    return res.status(400).json({ error: 'EMA投稿者（Owner）はプロジェクトから退出できません。' });
  }

  const follow = db.prepare('SELECT id FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(project_id, user_id) as any;
  if (follow) {
    db.prepare("UPDATE idea_follows SET is_mutual = 0, status = 'left' WHERE id = ?").run(follow.id);
  } else {
    db.prepare("INSERT INTO idea_follows (project_id, follower_id, is_mutual, status) VALUES (?, ?, 0, 'left')").run(project_id, user_id);
  }

  res.json({ success: true, message: 'プロジェクトから退出しました。' });
});

// Get project membership status
app.get('/api/projects/:id/membership', (req, res) => {
  const project_id = req.params.id;
  const user_id = req.query.user_id;
  
  const project = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(project_id) as any;
  if (!project) return res.status(404).json({ error: 'Not found' });
  
  if (project.author_id == user_id) {
    return res.json({ isMember: true, role: 'author' });
  }
  
  const follow = db.prepare('SELECT is_mutual, status FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(project_id, user_id) as any;
  const isMember = follow ? (follow.is_mutual === 1 && follow.status !== 'left') : false;
  res.json({
    isMember,
    role: follow ? 'follower' : 'none',
    status: follow ? (follow.status === 'left' ? 'left' : (follow.is_mutual === 1 ? 'member' : 'pending')) : 'none'
  });
});
app.get('/api/items/:type/:id/quotes', (req, res) => {
  const { type, id } = req.params;
  
  if (type !== 'project' && type !== 'idea') {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const table = type === 'project' ? 'projects' : 'ideas';
  const authorQuery = db.prepare(`SELECT author_id FROM ${table} WHERE id = ?`).get(id) as any;
  if (!authorQuery) return res.status(404).json({ error: 'Item not found' });
  
  const authorId = authorQuery.author_id;

  let quotes = db.prepare(`
    WITH RECURSIVE idea_tree AS (
      SELECT id, title, description, image, author_id, quoted_item_id, quoted_item_type, stage, created_at, is_private, permitted_users, 1 as level
      FROM ideas
      WHERE quoted_item_id = ? AND quoted_item_type = ? AND status = 'active'

      UNION ALL

      SELECT i.id, i.title, i.description, i.image, i.author_id, i.quoted_item_id, i.quoted_item_type, i.stage, i.created_at, i.is_private, i.permitted_users, it.level + 1
      FROM ideas i
      JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
      WHERE i.status = 'active'
    )
    SELECT t.id, t.title, t.description, t.image, t.author_id, t.quoted_item_id, t.quoted_item_type, t.stage, t.is_private, t.permitted_users, 'idea' as type,
           strftime('%Y-%m-%dT%H:%M:%SZ', t.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           q.title as quoted_item_title
    FROM idea_tree t
    JOIN users ON t.author_id = users.id
    LEFT JOIN ideas q ON t.quoted_item_id = q.id AND t.quoted_item_type = 'idea'
  `).all(id, type) as any[];

  const requestingUserId = req.query.user_id ? Number(req.query.user_id) : null;
  quotes = quotes.filter(q => {
    if (q.is_private !== 1) return true;
    if (!requestingUserId) return false;
    if (q.author_id === requestingUserId || authorId === requestingUserId) return true;
    try {
      const permitted = JSON.parse(q.permitted_users || '[]');
      if (permitted.some((p: any) => Number(p) === requestingUserId)) return true;
    } catch(e) {}
    return false;
  });

  const firstPostTime = new Map();
  quotes.forEach(idea => {
    const time = new Date(idea.created_at).getTime();
    if (!firstPostTime.has(idea.author_id) || time < firstPostTime.get(idea.author_id)) {
      firstPostTime.set(idea.author_id, time);
    }
  });

  quotes.sort((a: any, b: any) => {
    if (a.author_id === authorId && b.author_id !== authorId) return -1;
    if (a.author_id !== authorId && b.author_id === authorId) return 1;

    if (a.author_id !== b.author_id) {
       return firstPostTime.get(a.author_id) - firstPostTime.get(b.author_id);
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  res.json(quotes);
});


// Get project by id
app.get('/api/projects/:id', (req, res) => {
  const user_id = req.query.user_id || 0;
  const project = db.prepare(`
    SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.author_id, projects.quoted_item_id, projects.quoted_item_type, 
           projects.stage as author_stage, projects.latest_idea_id,
           projects.stage as stage,
           (SELECT COALESCE((SELECT i.stage FROM ideas i WHERE i.id = projects.quoted_item_id AND projects.quoted_item_type = 'idea'), (SELECT p.stage FROM projects p WHERE p.id = projects.quoted_item_id AND projects.quoted_item_type = 'project'), 1)) as min_stage,
           NULL as user_evaluated_stage,
           strftime('%Y-%m-%dT%H:%M:%SZ', projects.latest_idea_at) as latest_idea_at, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users,
           strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           (SELECT COUNT(*) FROM likes WHERE item_id = projects.id AND item_type = 'project') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,
           (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,
           (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = projects.id AND q.quoted_item_type = 'project'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
    FROM projects
    JOIN users ON projects.author_id = users.id
    WHERE projects.id = ?
  `).get(req.params.id);
  
  if (!project) return res.status(404).json({ error: 'Not found' });
  
  const comments = db.prepare(`
    SELECT comments.id, comments.content, comments.user_id, comments.project_id, comments.parent_id,
           strftime('%Y-%m-%dT%H:%M:%SZ', comments.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE project_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);

  res.json({ ...(project as any), comments });
});

app.get('/api/ideas/:id', (req, res) => {
  const user_id = req.query.user_id || 0;
  const idea = db.prepare(`
    SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, 
           ideas.stage as author_stage,
           ideas.stage as stage,
           (SELECT COALESCE((SELECT i.stage FROM ideas i WHERE i.id = ideas.quoted_item_id AND ideas.quoted_item_type = 'idea'), (SELECT p.stage FROM projects p WHERE p.id = ideas.quoted_item_id AND ideas.quoted_item_type = 'project'), 1)) as min_stage,
           NULL as user_evaluated_stage,
           ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users, ideas.tags,
           ideas.version, strftime('%Y-%m-%dT%H:%M:%SZ', ideas.updated_at) as updated_at, ideas.proposed_type, ideas.remand_reason, ideas.remand_changes, ideas.remand_notes,
           strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan,
           (SELECT COUNT(*) FROM likes WHERE item_id = ideas.id AND item_type = 'idea') as likes_count,
           (SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,
           (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,
           (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count, (
           WITH RECURSIVE idea_tree AS (
             SELECT id FROM ideas q WHERE q.quoted_item_id = ideas.id AND q.quoted_item_type = 'idea'
             UNION ALL
             SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
           )
           SELECT COUNT(*) FROM idea_tree
         ) as quotes_count
    FROM ideas
    JOIN users ON ideas.author_id = users.id
    WHERE ideas.id = ?
  `).get(req.params.id);
  
  if (!idea) return res.status(404).json({ error: 'Not found' });

  if (user_id && Number(user_id) > 0) {
    try {
      db.prepare('INSERT OR IGNORE INTO idea_reads (idea_id, user_id) VALUES (?, ?)').run(req.params.id, user_id);
    } catch (e) {}
  }
  
  const comments = db.prepare(`
    SELECT comments.id, comments.content, comments.user_id, comments.idea_id, comments.parent_id,
           strftime('%Y-%m-%dT%H:%M:%SZ', comments.created_at) as created_at,
           users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE comments.idea_id = ?
    ORDER BY comments.created_at ASC
  `).all(req.params.id);

  res.json({ ...(idea as any), comments });
});

// Post comment to idea
app.post('/api/ideas/:id/comments', (req, res) => {
  const { user_id, content, parent_id } = req.body;
  const idea_id = req.params.id;

  if (!userExists(user_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  try {
    const info = db.prepare('INSERT INTO comments (idea_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)').run(idea_id, user_id, content, parent_id);
    const comment = db.prepare(`
      SELECT comments.id, comments.content, comments.user_id, comments.idea_id, comments.parent_id,
             strftime('%Y-%m-%dT%H:%M:%SZ', comments.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan
      FROM comments
      JOIN users ON comments.user_id = users.id
      WHERE comments.id = ?
    `).get(info.lastInsertRowid);
    
    io.emit(`idea:${idea_id}:comment`, comment);
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// Post comment to project
app.post('/api/projects/:id/comments', (req, res) => {
  const { user_id, content, parent_id } = req.body;
  const project_id = req.params.id;

  if (!userExists(user_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  try {
    const info = db.prepare('INSERT INTO comments (project_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)').run(project_id, user_id, content, parent_id);
    const comment = db.prepare(`
      SELECT comments.id, comments.content, comments.user_id, comments.project_id, comments.parent_id,
             strftime('%Y-%m-%dT%H:%M:%SZ', comments.created_at) as created_at,
             users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan
      FROM comments
      JOIN users ON comments.user_id = users.id
      WHERE comments.id = ?
    `).get(info.lastInsertRowid);
    
    io.emit(`project:${project_id}:comment`, comment);
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

  
  
  // Recruitment Ideas & Selection Status APIs
  app.get('/api/recruitment/:id/ideas', (req, res) => {
    try {
      const recruitmentId = req.params.id;
      const orgId = req.query.org_id;

      // Find ideas quoted/linked to this recruitment (project or idea)
      const ideas = db.prepare(`
        SELECT i.*, u.username as author_name, u.avatar as author_avatar,
               COALESCE(iss.status, 'unreviewed') as selection_status
        FROM ideas i
        JOIN users u ON i.author_id = u.id
        LEFT JOIN idea_selection_statuses iss 
          ON iss.idea_id = i.id AND iss.recruitment_id = ? AND iss.org_id = ?
        WHERE (i.quoted_item_id = ? AND i.quoted_item_type IN ('project', 'idea'))
           OR i.id IN (SELECT idea_id FROM idea_selection_statuses WHERE recruitment_id = ?)
        ORDER BY i.created_at DESC
      `).all(recruitmentId, orgId || 0, recruitmentId, recruitmentId);

      res.json(ideas);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/recruitment/:id/ideas/:ideaId/status', (req, res) => {
    try {
      const recruitmentId = req.params.id;
      const ideaId = req.params.ideaId;
      const { status } = req.body;
      const orgId = req.headers['x-user-id'];

      if (!orgId || !status) {
        return res.status(400).json({ error: 'Missing parameters' });
      }

      db.prepare(`
        INSERT INTO idea_selection_statuses (recruitment_id, idea_id, org_id, status, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(recruitment_id, idea_id, org_id) 
        DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
      `).run(recruitmentId, ideaId, orgId, status);

      res.json({ success: true, status });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Offer Status APIs
  app.get('/api/offers/:id/status', (req, res) => {
    try {
      const offerId = req.params.id;
      const orgId = req.query.org_id;
      const offerStatus = db.prepare('SELECT * FROM offer_statuses WHERE offer_id = ? AND org_id = ?').get(offerId, orgId || 0);
      res.json(offerStatus || { status: 'sent', internal_memo: '', rejection_message: '' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/offers/:id/status', (req, res) => {
    try {
      const offerId = req.params.id;
      const { status, internal_memo, rejection_message } = req.body;
      const orgId = req.headers['x-user-id'];

      if (!orgId || !status) {
        return res.status(400).json({ error: 'Missing parameters' });
      }

      db.prepare(`
        INSERT INTO offer_statuses (offer_id, org_id, status, internal_memo, rejection_message, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(offer_id, org_id)
        DO UPDATE SET status = excluded.status, 
                      internal_memo = COALESCE(excluded.internal_memo, offer_statuses.internal_memo),
                      rejection_message = COALESCE(excluded.rejection_message, offer_statuses.rejection_message),
                      updated_at = CURRENT_TIMESTAMP
      `).run(offerId, orgId, status, internal_memo || null, rejection_message || null);

      res.json({ success: true, status });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Check Duplicate Scout API
  app.get('/api/scouts/check-duplicate', (req, res) => {
    try {
      const { source_type, recruitment_id, offer_id, receiver_id, sender_id, project_id, idea_id } = req.query;
      
      let query = "SELECT id, title, status, created_at FROM scouts WHERE sender_id = ? AND receiver_id = ? AND status IN ('sent', 'viewed', 'on_hold', 'discussion')";
      const params: any[] = [sender_id, receiver_id];

      if (source_type === 'recruitment' && recruitment_id) {
        query += " AND source_type = 'recruitment' AND recruitment_id = ?";
        params.push(recruitment_id);
      } else if (source_type === 'offer' && offer_id) {
        query += " AND source_type = 'offer' AND offer_id = ?";
        params.push(offer_id);
      } else if (project_id) {
        query += " AND project_id = ?";
        params.push(project_id);
      }

      const existing = db.prepare(query).get(...params) as any;
      if (existing) {
        return res.json({ exists: true, scout: existing });
      }
      res.json({ exists: false });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Post Scout
  app.post('/api/scouts', (req, res) => {
    try {
      const { 
        targetUserIds, project_id, reference_item_type, reference_item_id, reference_item_title,
        title, message, role, period, reward_type, reward_amount, time_estimate, location, 
        online_offline, deadline, nda, notes,
        source_type = 'direct', recruitment_id, offer_id, idea_id,
        nda_contract_id, outsourcing_contract_id, outsourcing_body
      } = req.body;
      const senderId = req.headers['x-user-id'];
      
      if (!senderId || !targetUserIds || !targetUserIds.length || !title || !message || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Fetch sender plan and details
      const sender = db.prepare('SELECT username, org_plan, account_type FROM users WHERE id = ?').get(senderId) as any;
      if (!sender || sender.account_type !== 'organization') {
        return res.status(403).json({ error: 'Only organizations can send scouts' });
      }

      // Plan restrictions
      const plan = sender.org_plan || 'light';
      if (source_type === 'direct' && plan === 'light') {
        return res.status(403).json({ error: 'Plan upgrade required for direct scouts' });
      }

      // Light plan monthly limit check for Recruitment and Offer scouts (combined max 5 per month)
      if (plan === 'light') {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const count = (db.prepare(`
          SELECT COUNT(*) as count FROM scouts 
          WHERE sender_id = ? AND source_type IN ('recruitment', 'offer') AND created_at >= ?
        `).get(senderId, startOfMonth) as any).count;

        if (count + targetUserIds.length > 5) {
          return res.status(403).json({ 
            error: 'monthly_limit_exceeded', 
            message: 'Lightプランの月間スカウト送信枠（5件）に達しました。' 
          });
        }
      }

      // Permission & Server-side validation
      if (source_type === 'recruitment' && recruitment_id) {
        let isAuthor = false;
        const ideaRec = db.prepare('SELECT author_id FROM ideas WHERE id = ?').get(recruitment_id) as any;
        if (ideaRec && ideaRec.author_id.toString() === senderId.toString()) {
          isAuthor = true;
        } else {
          const projRec = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(recruitment_id) as any;
          if (projRec && projRec.author_id.toString() === senderId.toString()) {
            isAuthor = true;
          }
        }
        if (!isAuthor) {
          return res.status(403).json({ error: 'Not authorized for this recruitment' });
        }
      } else if (source_type === 'offer' && offer_id) {
        let offer = db.prepare('SELECT permitted_users, author_id FROM ideas WHERE id = ?').get(offer_id) as any;
        if (!offer) {
          offer = db.prepare('SELECT permitted_users, author_id FROM projects WHERE id = ?').get(offer_id) as any;
        }
        if (!offer) {
          return res.status(404).json({ error: 'Offer not found' });
        }
        let permitted: any[] = [];
        try { permitted = JSON.parse(offer.permitted_users || '[]'); } catch (e) {}
        const isAuthor = offer.author_id?.toString() === senderId.toString();
        const isPermitted = permitted.some((u: any) => u?.toString() === senderId.toString());
        if (!isAuthor && !isPermitted) {
          return res.status(403).json({ error: 'Not authorized for this offer' });
        }
      }

      // Duplicate check for each recipient
      for (const userId of targetUserIds) {
        let dupQuery = "SELECT id FROM scouts WHERE sender_id = ? AND receiver_id = ? AND status IN ('sent', 'viewed', 'on_hold', 'discussion')";
        const dupParams: any[] = [senderId, userId];

        if (source_type === 'recruitment' && recruitment_id) {
          dupQuery += " AND source_type = 'recruitment' AND recruitment_id = ?";
          dupParams.push(recruitment_id);
        } else if (source_type === 'offer' && offer_id) {
          dupQuery += " AND source_type = 'offer' AND offer_id = ?";
          dupParams.push(offer_id);
        } else if (project_id) {
          dupQuery += " AND project_id = ?";
          dupParams.push(project_id);
        }

        const existing = db.prepare(dupQuery).get(...dupParams) as any;
        if (existing) {
          return res.status(400).json({ 
            error: 'duplicate_scout',
            message: 'このユーザーには、同じ内容のスカウトがすでに送信されています。',
            existing_scout_id: existing.id
          });
        }
      }

      // Requirement 17: Contract Snapshot Logic
      const senderUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(senderId) as any;
      const senderUserName = senderUser?.username || `User #${senderId}`;

      let ndaSnapTitle: string | null = null;
      let ndaSnapBody: string | null = null;
      let ndaSnapVersion: number | null = null;
      let ndaSnapHash: string | null = null;

      const { nda_title, nda_body, outsourcing_title } = req.body;

      if (nda_contract_id) {
        const ndaC = db.prepare('SELECT title, body, version FROM contracts WHERE id = ?').get(nda_contract_id) as any;
        if (ndaC) {
          ndaSnapTitle = ndaC.title;
          ndaSnapBody = ndaC.body;
          ndaSnapVersion = ndaC.version || 1;
          ndaSnapHash = crypto.createHash('sha256').update(ndaC.body || '').digest('hex');
        }
      }
      if (!ndaSnapBody && nda_body) {
        ndaSnapTitle = nda_title || '秘密保持契約書 (NDA)';
        ndaSnapBody = nda_body;
        ndaSnapVersion = 1;
        ndaSnapHash = crypto.createHash('sha256').update(nda_body || '').digest('hex');
      }

      let outSnapTitle: string | null = null;
      let outSnapBody: string | null = null;
      let outSnapVersion: number | null = null;
      let outSnapHash: string | null = null;

      if (outsourcing_contract_id) {
        const outC = db.prepare('SELECT title, body, version FROM contracts WHERE id = ?').get(outsourcing_contract_id) as any;
        if (outC) {
          outSnapTitle = outC.title;
          outSnapBody = outC.body;
          outSnapVersion = outC.version || 1;
          outSnapHash = crypto.createHash('sha256').update(outC.body || '').digest('hex');
        }
      }
      if (!outSnapBody && outsourcing_body) {
        outSnapTitle = outsourcing_title || '業務委託契約書 (契約案)';
        outSnapBody = outsourcing_body;
        outSnapVersion = 1;
        outSnapHash = crypto.createHash('sha256').update(outsourcing_body || '').digest('hex');
      }

      const hasContractAttached = Boolean(ndaSnapBody || outSnapBody);
      const attachedAt = hasContractAttached ? new Date().toISOString() : null;
      const attachedByUserId = hasContractAttached ? senderId : null;
      const attachedByUserName = hasContractAttached ? senderUserName : null;

      const insertScout = db.prepare(`
        INSERT INTO scouts (
          sender_id, receiver_id, project_id, reference_item_type, reference_item_id, reference_item_title,
          title, message, role, period, reward_type, reward_amount, time_estimate, location, 
          online_offline, deadline, nda, notes, status, source_type, recruitment_id, offer_id, idea_id,
          nda_contract_id, outsourcing_contract_id, outsourcing_body,
          nda_snapshot_title, nda_snapshot_body, nda_snapshot_version, nda_snapshot_hash,
          outsourcing_snapshot_title, outsourcing_snapshot_body, outsourcing_snapshot_version, outsourcing_snapshot_hash,
          attached_at, attached_by_user_id, attached_by_user_name
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const insertNotif = db.prepare('INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type) VALUES (?, ?, ?, ?, ?, ?)');

      db.transaction(() => {
        for (const userId of targetUserIds) {
          const receiver = db.prepare('SELECT scout_setting FROM users WHERE id = ?').get(userId) as any;
          if (receiver && receiver.scout_setting === 'none') {
            continue;
          }
          
          const info = insertScout.run(
            senderId, userId, project_id || null, reference_item_type || null, reference_item_id || null, reference_item_title || null,
            title, message, role, period || null, reward_type || null, reward_amount || null, time_estimate || null, location || null,
            online_offline || null, deadline || null, nda || null, notes || null,
            source_type, recruitment_id || null, offer_id || null, idea_id || null,
            nda_contract_id || null, outsourcing_contract_id || null, outsourcing_body || null,
            ndaSnapTitle, ndaSnapBody, ndaSnapVersion, ndaSnapHash,
            outSnapTitle, outSnapBody, outSnapVersion, outSnapHash,
            attachedAt, attachedByUserId, attachedByUserName
          );
          
          // Formulate notification text based on source_type
          let notifMsg = `「${sender.username}」から指名スカウトが届きました。`;
          if (source_type === 'recruitment') {
            notifMsg = `あなたが投稿したIDEAに対して、「${sender.username}」からスカウトが届きました。`;
          } else if (source_type === 'offer') {
            notifMsg = `あなたが送信したEMAに対して、「${sender.username}」からスカウトが届きました。`;
          }

          insertNotif.run(userId, senderId, 'scout_received', notifMsg, info.lastInsertRowid, 'scout');

          // Update Selection status or Offer status if applicable
          if (source_type === 'recruitment' && recruitment_id && idea_id) {
            db.prepare(`
              INSERT INTO idea_selection_statuses (recruitment_id, idea_id, org_id, status, updated_at)
              VALUES (?, ?, ?, 'scouted', CURRENT_TIMESTAMP)
              ON CONFLICT(recruitment_id, idea_id, org_id) DO UPDATE SET status = 'scouted', updated_at = CURRENT_TIMESTAMP
            `).run(recruitment_id, idea_id, senderId);
          } else if (source_type === 'offer' && offer_id) {
            db.prepare(`
              INSERT INTO offer_statuses (offer_id, org_id, status, updated_at)
              VALUES (?, ?, 'scouted', CURRENT_TIMESTAMP)
              ON CONFLICT(offer_id, org_id) DO UPDATE SET status = 'scouted', updated_at = CURRENT_TIMESTAMP
            `).run(offer_id, senderId);
          }
        }
      })();

      res.json({ success: true });
    } catch (e) {
      console.error('Error sending scouts:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/scouts/sent', (req, res) => {
    try {
      const userId = req.query.user_id;
      const status = req.query.status;
      const sourceType = req.query.source_type;

      let query = `
        SELECT s.*, u.username as receiver_name, u.avatar as receiver_avatar,
               r.title as recruitment_title, o.title as offer_title, i.title as idea_title
        FROM scouts s 
        JOIN users u ON s.receiver_id = u.id
        LEFT JOIN projects r ON s.recruitment_id = r.id
        LEFT JOIN projects o ON s.offer_id = o.id
        LEFT JOIN ideas i ON s.idea_id = i.id
        WHERE s.sender_id = ?
      `;
      const params = [userId];

      if (sourceType && sourceType !== 'all') {
        query += ' AND s.source_type = ?';
        params.push(sourceType);
      }

      if (status && status !== 'all') {
        query += ' AND s.status = ?';
        params.push(status);
      }

      query += ' ORDER BY s.created_at DESC';
      const scouts = db.prepare(query).all(...params);
      res.json(scouts);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/scouts/received', (req, res) => {
    try {
      const userId = req.query.user_id;
      const status = req.query.status;
      const sourceType = req.query.source_type;

      let query = `
        SELECT s.*, u.username as sender_name, u.avatar as sender_avatar,
               r.title as recruitment_title, o.title as offer_title, i.title as idea_title
        FROM scouts s 
        JOIN users u ON s.sender_id = u.id
        LEFT JOIN projects r ON s.recruitment_id = r.id
        LEFT JOIN projects o ON s.offer_id = o.id
        LEFT JOIN ideas i ON s.idea_id = i.id
        WHERE s.receiver_id = ?
      `;
      const params = [userId];

      if (sourceType && sourceType !== 'all') {
        query += ' AND s.source_type = ?';
        params.push(sourceType);
      }

      if (status && status !== 'all') {
        if (status === 'unread') {
           query += " AND s.status = 'sent'";
        } else {
           query += ' AND s.status = ?';
           params.push(status);
        }
      }

      query += ' ORDER BY s.created_at DESC';
      const scouts = db.prepare(query).all(...params);
      res.json(scouts);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.get('/api/scouts/:id', (req, res) => {
    try {
      const scoutId = req.params.id;
      const userId = req.query.user_id;
      
      const scout = db.prepare(`
        SELECT s.*, 
               sender.username as sender_name, sender.avatar as sender_avatar, 
               receiver.username as receiver_name, receiver.avatar as receiver_avatar, 
               p.title as project_title,
               r.title as recruitment_title, r.description as recruitment_desc,
               o.title as offer_title, o.description as offer_desc,
               i.title as idea_title, i.description as idea_desc
        FROM scouts s 
        JOIN users sender ON s.sender_id = sender.id 
        JOIN users receiver ON s.receiver_id = receiver.id 
        LEFT JOIN projects p ON s.project_id = p.id
        LEFT JOIN projects r ON s.recruitment_id = r.id
        LEFT JOIN projects o ON s.offer_id = o.id
        LEFT JOIN ideas i ON s.idea_id = i.id
        WHERE s.id = ?
      `).get(scoutId) as any;
      
      if (!scout) return res.status(404).json({ error: 'Not found' });
      
      if (scout.receiver_id.toString() === userId?.toString() && scout.status === 'sent') {
         db.prepare('UPDATE scouts SET status = ? WHERE id = ?').run('viewed', scout.id);
         scout.status = 'viewed';
      }

      // Attach NDA and Outsourcing contract details if available
      try {
        if (scout.nda_contract_id) {
          scout.nda_contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(scout.nda_contract_id);
        }
        if (scout.outsourcing_contract_id) {
          scout.outsourcing_contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(scout.outsourcing_contract_id);
        }
        // Fetch agreements associated with this scout
        scout.agreements = db.prepare(`
          SELECT a.*, u.username, u.avatar 
          FROM contract_agreements a 
          JOIN users u ON a.user_id = u.id 
          WHERE a.target_type = 'scout' AND a.target_id = ?
          ORDER BY a.created_at DESC
        `).all(scoutId);
      } catch (e) {
        console.warn('Failed to load contract details for scout:', e);
      }

      res.json(scout);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- CONTRACT MANAGEMENT ENDPOINTS ---

  // Get user's contracts / templates
  app.get('/api/contracts', (req, res) => {
    try {
      const userId = req.query.user_id || req.headers['x-user-id'];
      const type = req.query.type as string; // 'all' | 'nda' | 'outsourcing'
      const category = req.query.category as string; // 'recruitment' | 'offer' | 'scout' | 'common'
      const statusFilter = req.query.status as string; // 'all' | 'available' | 'draft' | 'archived' | 'nda' | 'outsourcing'
      const keyword = (req.query.keyword as string || '').trim().toLowerCase();
      const titleKeyword = (req.query.title_keyword as string || '').trim().toLowerCase();
      const bodyKeyword = (req.query.body_keyword as string || '').trim().toLowerCase();
      const authorFilter = (req.query.author as string || '').trim().toLowerCase();
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const sort = (req.query.sort as string) || 'updated_desc'; // 'updated_desc' | 'updated_asc' | 'title_asc' | 'usage_desc' | 'author_asc'

      const callingUser = db.prepare('SELECT account_type, organization_id FROM users WHERE id = ?').get(userId || 0) as any;
      const isIndividual = !callingUser || callingUser.account_type === 'individual';

      let query = `
        SELECT c.*, u.username as author_name
        FROM contracts c
        LEFT JOIN users u ON c.author_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // Requirement 24 Rule 1 & Rule 3: Individual users cannot view org templates; cannot view other orgs templates
      if (isIndividual) {
        query += ' AND (c.author_id = ? OR (c.is_template = 1 AND (c.organization_id IS NULL OR c.organization_id = 0)))';
        params.push(userId || 0);
      } else {
        query += ' AND (c.author_id = ? OR c.organization_id = ? OR c.sharing_scope = "all" OR c.is_template = 1)';
        params.push(userId || 0, callingUser.organization_id || userId || 0);
      }

      if (type && type !== 'all') {
        query += ' AND c.type = ?';
        params.push(type);
      }
      if (category && category !== 'all') {
        query += ' AND (c.category = ? OR c.category = "common")';
        params.push(category);
      }
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'nda') {
          query += ' AND c.type = "nda"';
        } else if (statusFilter === 'outsourcing') {
          query += ' AND c.type = "outsourcing"';
        } else if (['draft', 'attached', 'under_review', 'revision_requested', 'accepted', 'declined', 'superseded', 'invalidated', 'archived', 'available'].includes(statusFilter)) {
          query += ' AND c.status = ?';
          params.push(statusFilter);
        }
      }

      // Order By clause
      if (sort === 'updated_asc') {
        query += ' ORDER BY c.updated_at ASC';
      } else if (sort === 'title_asc') {
        query += ' ORDER BY c.title ASC';
      } else if (sort === 'usage_desc') {
        query += ' ORDER BY c.usage_count DESC, c.updated_at DESC';
      } else if (sort === 'author_asc') {
        query += ' ORDER BY u.username ASC, c.title ASC';
      } else {
        query += ' ORDER BY c.updated_at DESC';
      }

      let contracts = db.prepare(query).all(...params) as any[];

      // Seed standard NDA & Outsourcing templates if empty
      if (contracts.length === 0) {
        const defaultNDA = {
          id: -1,
          title: '標準秘密保持契約書 (NDA)',
          type: 'nda',
          category: 'common',
          body: `【秘密保持契約書 (NDA)】\n\n本契約は、開示者（甲）と受領者（乙）との間において、本プロジェクトに関する秘密情報の取り扱いについて定めるものです。\n\n第1条（目的）\n乙は、甲から開示された秘密情報を、本プロジェクトの検討・実施の目的のみに使用し、他の目的に使用してはならない。\n\n第2条（秘密情報の定義）\n「秘密情報」とは、甲が乙に対し、書面、口頭、電子データ等により開示する技術上、営業上その他の事業に関する一切の情報をいう。\n\n第3条（秘密保持義務）\n乙は、甲の事前の書面による承諾を得ない限り、秘密情報を第三者に開示・漏洩してはならない。\n\n第4条（契約期間）\n本契約の有効期間は、同意の日から2年間とする。\n\n第5条（管轄裁判所）\n本契約に関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とする。`,
          version: 1,
          author_id: 0,
          author_name: '法務チーム（標準）',
          is_template: 1,
          status: 'available',
          usage_count: 14,
          last_used_at: '2026-07-30 15:20:00',
          updated_at: '2026-07-28 10:00:00',
          created_at: '2026-07-28 10:00:00'
        };
        const defaultOutsourcing = {
          id: -2,
          title: '標準業務委託契約書 (契約案)',
          type: 'outsourcing',
          category: 'common',
          body: `【業務委託契約書】\n\n委託者（甲）および受託者（乙）は、以下のとおり業務委託契約を締結する。\n\n第1条（委託業務の内容）\n甲は乙に対し、本スカウト条件記載の役務・業務（開発、デザイン、企画、アドバイザリー等）を委託し、乙はこれを引き受ける。\n\n第2条（委託料および支払方法）\n委託料および支払時期・方法は、スカウト条件および双方の合意事項に基づき支払うものとする。\n\n第3条（成果物の著作権・知的財産権）\n本業務により生じた成果物の著作権その他知的財産権は、委託料の完済をもって甲に移転するものとする。\n\n第4条（再委託の禁止）\n乙は、甲の事前の書面による承諾を得ることなく、業務の全部または一部を第三者に再委託してはならない。\n\n第5条（契約解除）\nいずれの当事者も、相手方が本契約の条項に違反し、相当の期間を定めて催告したにもかかわらず正当な理由なく是正されない場合、本契約を解除することができる。`,
          version: 1,
          author_id: 0,
          author_name: '法務チーム（標準）',
          is_template: 1,
          status: 'available',
          usage_count: 9,
          last_used_at: '2026-07-31 11:45:00',
          updated_at: '2026-07-29 14:30:00',
          created_at: '2026-07-29 14:30:00'
        };
        const defaultDraft = {
          id: -3,
          title: '個別開発向け特約付き業務委託契約 (下書き)',
          type: 'outsourcing',
          category: 'common',
          body: `【業務委託契約書 (ドラフト)】\n\n第1条（業務概要）\n開発フェーズ1の受託業務を実施する。\n\n第2条（特記事項）\n納品後の瑕疵担保期間は3ヶ月とする。`,
          version: 1,
          author_id: 0,
          author_name: '社内作成',
          is_template: 1,
          status: 'draft',
          usage_count: 0,
          last_used_at: null,
          updated_at: '2026-07-30 09:15:00',
          created_at: '2026-07-30 09:15:00'
        };
        if (!type || type === 'nda') contracts.push(defaultNDA);
        if (!type || type === 'outsourcing') {
          contracts.push(defaultOutsourcing);
          contracts.push(defaultDraft);
        }
      }

      // Keyword & Advanced Filters
      if (keyword) {
        contracts = contracts.filter(c =>
          c.title.toLowerCase().includes(keyword) ||
          c.body.toLowerCase().includes(keyword) ||
          (c.author_name && c.author_name.toLowerCase().includes(keyword))
        );
      }
      if (titleKeyword) {
        contracts = contracts.filter(c => c.title.toLowerCase().includes(titleKeyword));
      }
      if (bodyKeyword) {
        contracts = contracts.filter(c => c.body.toLowerCase().includes(bodyKeyword));
      }
      if (authorFilter) {
        contracts = contracts.filter(c => c.author_name && c.author_name.toLowerCase().includes(authorFilter));
      }
      if (dateFrom) {
        contracts = contracts.filter(c => c.updated_at >= dateFrom);
      }
      if (dateTo) {
        contracts = contracts.filter(c => c.updated_at <= dateTo + ' 23:59:59');
      }

      // Re-sort JS array if in-memory seeded items were added
      if (sort === 'updated_asc') {
        contracts.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
      } else if (sort === 'title_asc') {
        contracts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (sort === 'usage_desc') {
        contracts.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
      } else if (sort === 'author_asc') {
        contracts.sort((a, b) => (a.author_name || '').localeCompare(b.author_name || ''));
      } else if (sort === 'updated_desc') {
        contracts.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      }

      res.json(contracts);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  // Requirement 23: Mask sensitive/personal info before sending to AI or logging
  function sanitizeInputForAI(text: string): string {
    if (!text) return '';
    return text
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[メールアドレス保護]')
      .replace(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/g, '[電話番号保護]')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[カード番号保護]')
      .replace(/〒?\d{3}[-\s]?\d{4}/g, '[郵便番号保護]');
  }

  // Requirement 13: Helper for Organization Plan AI Generation Limits
  function getOrgPlanInfo(user: any) {
    const rawPlan = (user?.org_plan || 'standard').toLowerCase();
    let plan = rawPlan;
    if (!['light', 'standard', 'enterprise'].includes(plan)) {
      plan = 'standard'; // Default plan is Standard (1/month)
    }

    let maxLimit = 1;
    let planLabel = 'Standardプラン';
    if (plan === 'light') {
      maxLimit = 0;
      planLabel = 'Lightプラン';
    } else if (plan === 'enterprise') {
      maxLimit = 9999; // Unlimited
      planLabel = 'Enterpriseプラン';
    }

    return {
      plan,
      planLabel,
      maxLimit,
      canDirectInput: true,
      canUseSaved: true
    };
  }

  // Update user organization plan (for testing & plan selection)
  app.put('/api/users/plan', (req, res) => {
    try {
      const userId = req.body.user_id || req.headers['x-user-id'];
      const { plan } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing user_id' });
      if (!plan || !['light', 'standard', 'enterprise'].includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan. Must be light, standard, or enterprise.' });
      }

      db.prepare('UPDATE users SET org_plan = ? WHERE id = ?').run(plan, userId);
      res.json({ success: true, plan });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update user plan' });
    }
  });

  // Interactive Chat Contract AI Generation Endpoint
  app.post('/api/contracts/chat-ai', async (req, res) => {
    try {
      const userId = req.body.user_id || req.headers['x-user-id'];
      if (!userId) return res.status(400).json({ error: 'Missing user_id' });

      const {
        type = 'nda',
        category = 'common',
        messages = [],
        projectTitle = '対象プロジェクト',
        role = '受託メンバー',
        partyA,
        partyB,
        is_revision = false,
        source_screen = 'contract_library',
        generation_session_id
      } = req.body;

      // Plan Limit Check (Org-Level)
      const user = db.prepare('SELECT username, org_plan, account_type, organization_id FROM users WHERE id = ?').get(userId) as any;
      const orgId = user?.organization_id || user?.id || Number(userId);
      const planInfo = getOrgPlanInfo(user);

      const currentMonth = new Date().toISOString().substring(0, 7);
      let limitRec = db.prepare('SELECT * FROM contract_ai_limits WHERE (organization_id = ? OR user_id = ?) AND month_year = ?').get(orgId, userId, currentMonth) as any;
      const currentCount = limitRec ? limitRec.generation_count : 0;

      // Check if user is attempting initial generation and has exceeded quota
      const isRevision = is_revision || (Array.isArray(messages) && messages.filter((m: any) => m.sender === 'user').length > 1);

      if (!isRevision && currentCount >= planInfo.maxLimit) {
        if (planInfo.plan === 'light') {
          return res.status(403).json({
            error: 'ai_limit_exceeded',
            message: '契約文章のAI自動生成は、Standardプラン以上で利用できます。\n\nチャット形式で条件を入力すると、秘密保持契約や業務委託契約の文章案を作成できます。\n生成後は自由に編集・保存できます。',
            plan: 'light',
            max_limit: 0,
            used_count: currentCount
          });
        }
        return res.status(403).json({
          error: 'ai_limit_exceeded',
          message: '今月の契約文章AI生成枠を使用しました。\n\nEnterpriseプランでは、契約文章のAI生成を無制限で利用できます。\n来月まで待つか、プランをご確認ください。',
          plan: planInfo.plan,
          max_limit: planInfo.maxLimit,
          used_count: currentCount
        });
      }

      const conversationHistory = messages.map((m: any) => `${m.sender === 'user' ? 'ユーザー' : 'AI法務アシスタント'}: ${m.text}`).join('\n');

      const systemPrompt = `
あなたは契約法務のプロフェッショナルなAI法務アシスタントです。
現在、ユーザーと対話しながら「${type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書'}」の作成を行なっています。

【基本情報】
* 契約種別: ${type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書'}
* 区分: ${category}
* 対象プロジェクト: ${projectTitle}
* 役割・役職: ${role}
* 甲 (発注側/委託者/開示者): ${partyA || user?.username || '【未設定】（甲）'}
* 乙 (受注側/受託者/受領者): ${partyB || '【未設定】（乙）'}

【ユーザーとの対話履歴】
${conversationHistory}

【必要に応じた確認項目チェックリスト】
${type === 'nda' ? `
《秘密保持契約 (NDA) 確認項目》
- 契約当事者（甲・乙）
- 秘密情報を開示する側／受領する側（相互開示か片方向か）
- 秘密情報の定義
- 利用目的
- 秘密情報に含まれない情報
- 第三者提供の可否
- 複製の可否
- 管理方法
- 漏えい時の対応
- 返還・破棄
- 秘密保持期間・契約期間
- 知的財産権
- 損害賠償
- 反社会的勢力の排除
- 準拠法・合意管轄
- その他の要望
` : `
《業務委託契約 確認項目》
- 委託者・受託者
- 業務内容・業務範囲・成果物・納品形式
- 契約期間（開始日・終了日）
- 作業場所・リモート対応・稼働時間の目安
- 報酬額・消費税の扱い・支払日・支払方法・経費負担
- 再委託の可否
- 検収方法・修正対応・瑕疵/契約不適合への対応
- 知的財産権・著作者人格権
- 秘密保持・個人情報
- 契約解除・中途解約
- 損害賠償
- 反社会的勢力の排除
- 準拠法・合意管轄
- その他の条件
`}

【重要ルール（絶対遵守）】
1. 不足している項目について、AIが勝手に重大な条件や金額・期間・権利帰属を勝手に確定・創作しないでください。
2. ユーザーとの対話で確定していない部分・未設定の項目については、契約書本文中に必ず「【要確認】」「【未設定】」「【当事者間で協議】」のいずれかの表記を用いて明示してください。
3. 生成する文章は、法的助言や完全な有効性を保証するような表現は一切避け、たたき台（草案）としての位置付けを維持してください。
4. 対話の返答（replyMessage）では、未確認事項があればユーザーへ質問やアドバイスを丁寧に行ってください。

【出力フォーマット】
以下の純粋なJSONオブジェクト（Markdownコードブロックなし）で返答してください。
{
  "replyMessage": "ユーザーへの丁寧な回答、アドバイス、未確定項目に関する確認質問",
  "contractTitle": "${type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書 (契約案)'}",
  "contractBody": "完成した契約書の最新本文（未確定箇所は【要確認】【未設定】【当事者間で協議】と明記）"
}
`;

      let jsonResponse: any = null;
      try {
        const response = { text: await generateText(systemPrompt) };
        const text = response.text || '';
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonResponse = JSON.parse(cleanedText);
      } catch (openaiError: any) {
        console.warn('OpenAI chat contract gen failed, fallbacking:', openaiError?.message);
        jsonResponse = {
          replyMessage: "ご要望を反映して契約書のたたき台を作成・更新しました。\n不足項目がある場合は確認の質問をさせていただきます。",
          contractTitle: type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書 (契約案)',
          contractBody: type === 'nda' ? `【秘密保持契約書 (NDA)】

本契約は、${partyA || '【未設定】（甲）'}と${partyB || '【未設定】（乙）'}との間において、${projectTitle}に関する秘密情報の取り扱いについて定めるものである。

第1条（目的および開示区分）
本契約は、甲乙間における【要確認】（開示区分: 【当事者間で協議】）を目的とする。

第2条（秘密情報の定義）
本契約における秘密情報とは、開示当事者が相手方に開示する営業上または技術上の情報をいう。ただし、公知の情報等【未設定】は除く。

第3条（秘密保持および第三者提供）
受領当事者は、事前承諾なく秘密情報を第三者に開示・漏洩してはならない。複製の可否: 【当事者間で協議】。

第4条（秘密保持期間）
秘密保持義務の期間は、契約締結日から【要確認】年間とする。

第5条（損害賠償・準拠法）
違約時の損害賠償金額: 【当事者間で協議】。本契約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とする。` : `【業務委託契約書】

本契約は、委託者 ${partyA || '【未設定】（甲）'} と受託者 ${partyB || '【未設定】（乙）'} との間において、以下のとおり業務委託契約を締結する。

第1条（委託業務・成果物）
甲は乙に対し、${projectTitle}（役割: ${role}）に関する業務を委託し、乙はこれを受託する。
1. 業務内容・範囲: 【要確認】
2. 成果物および納品形式: 【未設定】

第2条（契約期間および作業場所）
1. 契約期間: 【要確認】（開始日: 【未設定】 〜 終了日: 【未設定】）
2. 作業場所: リモート対応可【当事者間で協議】

第3条（報酬・支払方法）
1. 報酬額: 【要確認】（消費税の扱い: 【未設定】）
2. 支払日および方法: 【当事者間で協議】
3. 経費負担: 【未設定】

第4条（知的財産権および著作者人格権）
成果物に関する著作権等の知的財産権の帰属: 【要確認】。乙は著作者人格権を行使しない【当事者間で協議】。

第5条（検収・契約不適合・解除）
1. 検収方法および修正対応: 【要確認】
2. 契約解除および中途解約: 【当事者間で協議】

第6条（その他・合意管轄）
反社会的勢力の排除、秘密保持義務を遵守する。準拠法は日本法とし、管轄裁判所は【要確認】とする。`
        };
      }

      // Increment count ONLY IF this is a new generation session (not a session revision)
      let updatedCount = currentCount;
      const sessionId = generation_session_id || `sess_${Date.now()}`;
      if (!isRevision) {
        if (limitRec) {
          db.prepare('UPDATE contract_ai_limits SET generation_count = generation_count + 1, organization_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(orgId, limitRec.id);
        } else {
          db.prepare('INSERT INTO contract_ai_limits (organization_id, user_id, month_year, generation_count) VALUES (?, ?, ?, 1)').run(orgId, userId, currentMonth);
        }
        updatedCount = currentCount + 1;

        // Requirement 16: Log audit trail
        try {
          db.prepare(`
            INSERT INTO contract_ai_generation_logs (organization_id, user_id, generation_type, contract_type, source_screen, generation_session_id, year_month, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'success')
          `).run(orgId, userId, 'chat', type, source_screen, sessionId, currentMonth);
        } catch (logErr) {
          console.error('Failed to log contract AI generation:', logErr);
        }
      }

      // Requirement 23: Save AI chat history in contract_ai_chats model with sanitized prompt
      try {
        const sanitizedPrompt = sanitizeInputForAI(systemPrompt);
        db.prepare(`
          INSERT INTO contract_ai_chats (organization_id, user_id, session_id, contract_type, sanitized_prompt, ai_reply, contract_body_snapshot)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(orgId, userId, sessionId, type, sanitizedPrompt, jsonResponse.replyMessage, jsonResponse.contractBody);
      } catch (chatLogErr) {
        console.error('Failed to log contract AI chat history:', chatLogErr);
      }

      res.json({
        replyMessage: jsonResponse.replyMessage,
        contractTitle: jsonResponse.contractTitle,
        contractBody: jsonResponse.contractBody,
        used_count: updatedCount,
        max_limit: planInfo.maxLimit,
        plan: planInfo.plan,
        plan_label: planInfo.planLabel,
        is_revision: isRevision,
        organization_id: orgId,
        remaining: planInfo.plan === 'enterprise' ? 9999 : Math.max(0, planInfo.maxLimit - updatedCount)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'AI contract chat failed' });
    }
  });

  // Get AI generation limits for current user / organization
  app.get('/api/contracts/ai-limits', (req, res) => {
    try {
      const userId = req.query.user_id || req.headers['x-user-id'];
      if (!userId) return res.status(400).json({ error: 'Missing user_id' });

      const user = db.prepare('SELECT org_plan, account_type, organization_id FROM users WHERE id = ?').get(userId) as any;
      const orgId = user?.organization_id || user?.id || Number(userId);
      const planInfo = getOrgPlanInfo(user);

      const currentMonth = new Date().toISOString().substring(0, 7);
      const limitRec = db.prepare('SELECT generation_count FROM contract_ai_limits WHERE (organization_id = ? OR user_id = ?) AND month_year = ?').get(orgId, userId, currentMonth) as any;
      const currentCount = limitRec ? limitRec.generation_count : 0;

      res.json({
        organization_id: orgId,
        month_year: currentMonth,
        plan: planInfo.plan,
        plan_label: planInfo.planLabel,
        used_count: currentCount,
        max_limit: planInfo.maxLimit,
        remaining: planInfo.plan === 'enterprise' ? 9999 : Math.max(0, planInfo.maxLimit - currentCount),
        can_direct_input: true,
        can_use_saved: true
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch AI limits' });
    }
  });

  // Generate contract text via AI (OpenAI API)
  app.post('/api/contracts/generate-ai', async (req, res) => {
    try {
      const userId = req.body.user_id || req.headers['x-user-id'];
      if (!userId) return res.status(400).json({ error: 'Missing user_id' });

      const {
        type = 'nda',
        category = 'common',
        title,
        role,
        project_title,
        party_a,
        party_b,
        special_terms,
        is_revision = false,
        source_screen = 'contract_library',
        generation_session_id
      } = req.body;

      // Plan Limit Check (Org-Level)
      const user = db.prepare('SELECT org_plan, account_type, organization_id FROM users WHERE id = ?').get(userId) as any;
      const orgId = user?.organization_id || user?.id || Number(userId);
      const planInfo = getOrgPlanInfo(user);

      const currentMonth = new Date().toISOString().substring(0, 7);
      let limitRec = db.prepare('SELECT * FROM contract_ai_limits WHERE (organization_id = ? OR user_id = ?) AND month_year = ?').get(orgId, userId, currentMonth) as any;
      const currentCount = limitRec ? limitRec.generation_count : 0;

      if (!is_revision && currentCount >= planInfo.maxLimit) {
        if (planInfo.plan === 'light') {
          return res.status(403).json({
            error: 'ai_limit_exceeded',
            message: '契約文章のAI自動生成は、Standardプラン以上で利用できます。\n\nチャット形式で条件を入力すると、秘密保持契約や業務委託契約の文章案を作成できます。\n生成後は自由に編集・保存できます。',
            plan: 'light',
            max_limit: 0,
            used_count: currentCount
          });
        }
        return res.status(403).json({
          error: 'ai_limit_exceeded',
          message: '今月の契約文章AI生成枠を使用しました。\n\nEnterpriseプランでは、契約文章のAI生成を無制限で利用できます。\n来月まで待つか、プランをご確認ください。',
          plan: planInfo.plan,
          max_limit: planInfo.maxLimit,
          used_count: currentCount
        });
      }

      const prompt = `
あなたは日本の契約法務・弁護士レベルのAI法務アシスタントです。
以下の条件に基づき、高品質かつ法的に実用的な「${type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書'}」の本文を生成してください。

契約種別: ${type === 'nda' ? '秘密保持契約書 (NDA)' : '業務委託契約書'}
適用対象カテゴリ: ${category} (${category === 'recruitment' ? 'Recruitment経由' : category === 'offer' ? 'Offer経由' : category === 'scout' ? '指名スカウト経由' : '共通'})
タイトル/件名: ${title || (type === 'nda' ? '秘密保持契約書' : '業務委託契約書')}
甲 (委託者/開示者): ${party_a || '発注側（組織/企業）'}
乙 (受託者/受領者): ${party_b || '受注側（個人/メンバー）'}
対象プロジェクト/役職: ${project_title || '対象プロジェクト'} / ${role || 'メンバー'}
特記事項/追加条件: ${special_terms || 'なし'}

要求仕様:
1. 日本語の法的様式に従い、第1条〜第8条程度の体系的な条文構成にすること。
2. 甲および乙の権利義務、秘密保持または業務範囲、成果物の帰属、委託料・支払条件、契約期間、解除条項、損害賠償、合意管轄を明記すること。
3. コードブロックや余計な解説を含めず、契約書本文のみをテキスト出力すること。
      `;

      let generatedBody = '';
      try {
        const response = { text: await generateText(prompt) };
        generatedBody = response.text || '';
      } catch (openaiError: any) {
        console.warn('OpenAI contract gen failed, fallbacking:', openaiError?.message);
        generatedBody = `【${title || (type === 'nda' ? '秘密保持契約書' : '業務委託契約書')}】\n\n本契約は、${party_a || '甲（発注側）'}と${party_b || '乙（受託側）'}との間において、${project_title || '対象プロジェクト'}（役職：${role || 'メンバー'}）に関する契約条件を定めるものである。\n\n第1条（目的）\n甲は乙に対し本プロジェクトに関する業務を委託・連携し、乙は誠実にこれを履行する。\n\n第2条（権利帰属および秘密保持）\n本業務により生じた成果物および秘密情報の取り扱いについて、両当事者は厳正に管理するものとする。\n\n第3条（特約事項）\n${special_terms || '双方の合意に基づき業務を実施する。'}\n\n第4条（協議事項）\n本契約に定めのない事項については、甲乙協議のうえ誠意をもって解決する。`;
      }

      // Increment count ONLY IF this is a new generation session
      let updatedCount = currentCount;
      const sessionId = generation_session_id || `sess_${Date.now()}`;
      if (!is_revision) {
        if (limitRec) {
          db.prepare('UPDATE contract_ai_limits SET generation_count = generation_count + 1, organization_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(orgId, limitRec.id);
        } else {
          db.prepare('INSERT INTO contract_ai_limits (organization_id, user_id, month_year, generation_count) VALUES (?, ?, ?, 1)').run(orgId, userId, currentMonth);
        }
        updatedCount = currentCount + 1;

        // Requirement 16: Log audit trail
        try {
          db.prepare(`
            INSERT INTO contract_ai_generation_logs (organization_id, user_id, generation_type, contract_type, source_screen, generation_session_id, year_month, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'success')
          `).run(orgId, userId, 'preset', type, source_screen, sessionId, currentMonth);
        } catch (logErr) {
          console.error('Failed to log generate-ai:', logErr);
        }
      }

      // Requirement 23: Save AI generation in contract_ai_chats model with sanitized prompt
      try {
        const sanitizedPrompt = sanitizeInputForAI(prompt);
        db.prepare(`
          INSERT INTO contract_ai_chats (organization_id, user_id, session_id, contract_type, sanitized_prompt, ai_reply, contract_body_snapshot)
          VALUES (?, ?, ?, ?, ?, '契約文章AI自動生成', ?)
        `).run(orgId, userId, sessionId, type, sanitizedPrompt, generatedBody);
      } catch (chatLogErr) {
        console.error('Failed to log contract AI generation history:', chatLogErr);
      }

      res.json({
        title: title || (type === 'nda' ? '秘密保持契約書 (AI生成)' : '業務委託契約書 (AI生成)'),
        type,
        category,
        body: generatedBody,
        used_count: updatedCount,
        max_limit: planInfo.maxLimit,
        plan: planInfo.plan,
        plan_label: planInfo.planLabel,
        is_revision,
        remaining: planInfo.plan === 'enterprise' ? 9999 : Math.max(0, planInfo.maxLimit - updatedCount)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'AI contract generation failed' });
    }
  });

  // Create contract template / draft
  app.post('/api/contracts', (req, res) => {
    try {
      const authorId = req.headers['x-user-id'] || req.body.author_id;
      const {
        title,
        type = 'nda',
        category = 'common',
        description = '',
        body,
        tags = '',
        sharing_scope = 'all',
        status = 'available',
        is_template = 1,
        organization_id
      } = req.body;

      if (!authorId || !title || !body) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const info = db.prepare(`
        INSERT INTO contracts (title, type, category, description, body, tags, sharing_scope, status, version, author_id, organization_id, is_template)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(title, type, category, description, body, tags, sharing_scope, status, authorId, organization_id || null, is_template ? 1 : 0);

      const contractId = info.lastInsertRowid;
      const contentHash = crypto.createHash('sha256').update(`${title}\n${body}`).digest('hex');

      // Save version 1 with full version metadata
      db.prepare(`
        INSERT INTO contract_versions (contract_id, version, title, body, change_summary, created_by, previous_version, content_hash)
        VALUES (?, 1, ?, ?, '初版作成 (第1版)', ?, NULL, ?)
      `).run(contractId, title, body, authorId, contentHash);

      // Audit log
      db.prepare(`
        INSERT INTO contract_audit_logs (contract_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'created', ?, ?)
      `).run(contractId, authorId, `新規作成: ${title} (第1版, Hash: ${contentHash.substring(0, 8)}...)`, (req.headers['x-forwarded-for'] as string || req.ip || '').toString());

      const created = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
      res.json(created);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create contract' });
    }
  });

  // Get single contract detail with version history
  app.get('/api/contracts/:id', (req, res) => {
    try {
      const contractId = req.params.id;
      if (Number(contractId) < 0) {
        const title = contractId === '-1' ? '標準秘密保持契約書 (NDA)' : '標準業務委託契約書';
        const body = contractId === '-1'
          ? `【秘密保持契約書 (NDA)】\n\n本契約は、開示者（甲）と受領者（乙）との間において、本プロジェクトに関する秘密情報の取り扱いについて定めるものです...`
          : `【業務委託契約書】\n\n委託者（甲）および受託者（乙）は、以下のとおり業務委託契約を締結する...`;
        const defaultHash = crypto.createHash('sha256').update(`${title}\n${body}`).digest('hex');

        return res.json({
          id: Number(contractId),
          title: title,
          type: contractId === '-1' ? 'nda' : 'outsourcing',
          category: 'common',
          description: '標準的なテンプレート文章です。',
          body: body,
          tags: '標準,社内用',
          sharing_scope: 'all',
          status: 'available',
          version: 1,
          versions: [
            {
              id: -1,
              contract_id: Number(contractId),
              version: 1,
              title: title,
              body: body,
              change_summary: '標準初期システムテンプレート (第1版)',
              created_by: 1,
              created_at: new Date().toISOString(),
              previous_version: null,
              content_hash: defaultHash
            }
          ]
        });
      }

      const userId = req.headers['x-user-id'] || req.query.user_id;
      const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      // Requirement 24 Rule 11: Direct URL access control for non-public contracts
      if (contract.sharing_scope === 'private' || contract.organization_id) {
        if (userId) {
          const callingUser = db.prepare('SELECT account_type, organization_id FROM users WHERE id = ?').get(userId) as any;
          const isOwner = contract.author_id?.toString() === userId.toString();
          const isSameOrg = callingUser?.organization_id && contract.organization_id && callingUser.organization_id === contract.organization_id;
          const isScoutParty = db.prepare('SELECT id FROM scouts WHERE (nda_contract_id = ? OR outsourcing_contract_id = ?) AND (sender_id = ? OR receiver_id = ?)').get(contractId, contractId, userId, userId);

          if (!isOwner && !isSameOrg && !isScoutParty && callingUser?.account_type === 'individual') {
            return res.status(403).json({ error: 'Forbidden', message: '他組織の非公開契約書へアクセスする権限はありません。' });
          }
        }
      }

      const versions = db.prepare('SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version DESC').all(contractId);
      contract.versions = versions;

      res.json(contract);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  });

  // Edit contract (create new version)
  app.put('/api/contracts/:id', (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = req.headers['x-user-id'] || req.body.user_id;
      const callingUser = db.prepare('SELECT account_type, organization_id FROM users WHERE id = ?').get(userId) as any;

      if (!callingUser || callingUser.account_type === 'individual') {
        return res.status(403).json({ error: 'individual_forbidden', message: '個人ユーザーは契約テンプレートを編集する権限がありません。組織担当者の権限が必要です。' });
      }

      const {
        title,
        type,
        category,
        description,
        body,
        tags,
        sharing_scope,
        status,
        change_summary = '第2版への更新'
      } = req.body;

      // Handle virtual default items (< 0)
      if (Number(contractId) < 0) {
        const finalTitle = title || 'カスタム契約書';
        const finalBody = body || '';
        const contentHash = crypto.createHash('sha256').update(`${finalTitle}\n${finalBody}`).digest('hex');

        const info = db.prepare(`
          INSERT INTO contracts (title, type, category, description, body, tags, sharing_scope, version, author_id, organization_id, status, is_template)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)
        `).run(
          finalTitle,
          type || (Number(contractId) === -1 ? 'nda' : 'outsourcing'),
          category || 'common',
          description || '',
          finalBody,
          tags || '',
          sharing_scope || 'all',
          userId || 1,
          callingUser.organization_id || userId || 1,
          status || 'available'
        );
        const newId = info.lastInsertRowid;
        db.prepare(`
          INSERT INTO contract_versions (contract_id, version, title, body, change_summary, created_by, previous_version, content_hash)
          VALUES (?, 1, ?, ?, 'システムテンプレートからのカスタム作成', ?, NULL, ?)
        `).run(newId, finalTitle, finalBody, userId || 1, contentHash);

        const newContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(newId);
        return res.json(newContract);
      }

      const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
      if (!existing) return res.status(404).json({ error: 'Contract not found' });

      // Requirement 24 Rule 3: Cannot edit contracts belonging to another organization
      if (existing.organization_id && callingUser.organization_id && existing.organization_id !== callingUser.organization_id) {
        return res.status(403).json({ error: 'Forbidden', message: '他組織の契約文章を編集する権限はありません。' });
      }

      const previousVersion = existing.version || 1;
      const newVersion = previousVersion + 1;
      const finalTitle = title || existing.title;
      const finalBody = body || existing.body;
      const contentHash = crypto.createHash('sha256').update(`${finalTitle}\n${finalBody}`).digest('hex');

      db.prepare(`
        UPDATE contracts
        SET title = ?, type = ?, category = ?, description = ?, body = ?, tags = ?, sharing_scope = ?, status = ?, version = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        finalTitle,
        type || existing.type || 'nda',
        category || existing.category || 'common',
        description !== undefined ? description : existing.description,
        finalBody,
        tags !== undefined ? tags : existing.tags,
        sharing_scope || existing.sharing_scope || 'all',
        status || existing.status || 'available',
        newVersion,
        contractId
      );

      db.prepare(`
        INSERT INTO contract_versions (contract_id, version, title, body, change_summary, created_by, previous_version, content_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(contractId, newVersion, finalTitle, finalBody, change_summary, userId || existing.author_id, previousVersion, contentHash);

      db.prepare(`
        INSERT INTO contract_audit_logs (contract_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'version_update', ?, ?)
      `).run(contractId, userId || existing.author_id, `改訂 第${newVersion}版: ${change_summary} (Hash: ${contentHash.substring(0, 8)}...)`, (req.headers['x-forwarded-for'] as string || req.ip || '').toString());

      const updated = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update contract' });
    }
  });

  // Duplicate contract
  app.post('/api/contracts/:id/duplicate', (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = req.headers['x-user-id'] || req.body.user_id;
      const callingUser = db.prepare('SELECT account_type, organization_id FROM users WHERE id = ?').get(userId) as any;

      if (!callingUser || callingUser.account_type === 'individual') {
        return res.status(403).json({ error: 'individual_forbidden', message: '個人ユーザーは組織の契約テンプレートを複製する権限がありません。' });
      }

      let sourceTitle = '契約書';
      let sourceType = 'nda';
      let sourceCategory = 'common';
      let sourceBody = '';

      if (Number(contractId) < 0) {
        if (Number(contractId) === -1) {
          sourceTitle = '標準秘密保持契約書 (NDA)';
          sourceType = 'nda';
          sourceBody = `【秘密保持契約書 (NDA)】\n\n本契約は、開示者（甲）と受領者（乙）との間において、本プロジェクトに関する秘密情報の取り扱いについて定めるものです...`;
        } else {
          sourceTitle = '標準業務委託契約書 (契約案)';
          sourceType = 'outsourcing';
          sourceBody = `【業務委託契約書】\n\n委託者（甲）および受託者（乙）は、以下のとおり業務委託契約を締結する...`;
        }
      } else {
        const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
        if (!existing) return res.status(404).json({ error: 'Contract not found' });
        // Requirement 24 Rule 3: Cannot view or duplicate private contracts of another organization
        if (existing.organization_id && callingUser.organization_id && existing.organization_id !== callingUser.organization_id && existing.sharing_scope === 'private') {
          return res.status(403).json({ error: 'Forbidden', message: '他組織の非公開契約書を複製する権限はありません。' });
        }
        sourceTitle = existing.title;
        sourceType = existing.type;
        sourceCategory = existing.category;
        sourceBody = existing.body;
      }

      const dupTitle = `【複製】${sourceTitle}`;
      const contentHash = crypto.createHash('sha256').update(`${dupTitle}\n${sourceBody}`).digest('hex');

      const info = db.prepare(`
        INSERT INTO contracts (title, type, category, body, version, author_id, organization_id, status, is_template)
        VALUES (?, ?, ?, ?, 1, ?, ?, 'available', 0)
      `).run(dupTitle, sourceType, sourceCategory, sourceBody, userId || 1, callingUser?.organization_id || userId || 1);

      const dupId = info.lastInsertRowid;
      db.prepare(`
        INSERT INTO contract_versions (contract_id, version, title, body, change_summary, created_by, previous_version, content_hash)
        VALUES (?, 1, ?, ?, 'テンプレートの複製による初版作成', ?, NULL, ?)
      `).run(dupId, dupTitle, sourceBody, userId || 1, contentHash);

      const duplicated = db.prepare('SELECT * FROM contracts WHERE id = ?').get(dupId);
      res.json(duplicated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to duplicate contract' });
    }
  });

  // Archive / Change status of contract
  app.patch('/api/contracts/:id/status', (req, res) => {
    try {
      const contractId = req.params.id;
      const { status } = req.body;
      const validStatuses = [
        'draft',
        'attached',
        'under_review',
        'revision_requested',
        'accepted',
        'declined',
        'superseded',
        'invalidated',
        'archived',
        'available'
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid contract status' });
      }

      db.prepare('UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, contractId);
      const updated = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
      res.json(updated || { id: contractId, status });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to change contract status' });
    }
  });

  // Delete contract (Rule 10: Agreed contracts cannot be deleted; archived instead)
  app.delete('/api/contracts/:id', (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = req.headers['x-user-id'];
      const callingUser = db.prepare('SELECT account_type, organization_id FROM users WHERE id = ?').get(userId) as any;

      const existing = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any;
      if (!existing) return res.status(404).json({ error: 'Contract not found' });

      if (existing.organization_id && callingUser?.organization_id && existing.organization_id !== callingUser.organization_id) {
        return res.status(403).json({ error: 'Forbidden', message: '他組織の契約書を削除する権限はありません。' });
      }

      // Requirement 24 Rule 10: Agreed contracts cannot be deleted; only archived or voided
      const agreementsCount = (db.prepare('SELECT COUNT(*) as cnt FROM contract_agreements WHERE contract_id = ? AND status = "agreed"').get(contractId) as any)?.cnt || 0;
      if (agreementsCount > 0) {
        db.prepare('UPDATE contracts SET status = "archived", updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(contractId);
        return res.json({
          success: true,
          is_archived: true,
          message: '同意済みの契約書は証拠保持のため物理削除できません。ステータスをアーカイブに更新しました。'
        });
      }

      db.prepare('DELETE FROM contracts WHERE id = ?').run(contractId);
      res.json({ success: true, id: contractId });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete contract' });
    }
  });

  // Submit Electronic Agreement with Immutable Snapshot Protection (Requirement 22)
  app.post('/api/contracts/agreements', (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.body.user_id;
      const {
        contract_id,
        contract_version = 1,
        snapshot_title: inputTitle,
        snapshot_body: inputBody,
        target_type = 'scout',
        target_id,
        signature_name,
        status = 'agreed',
        agreement_method = 'electronic_signature',
        language = 'ja',
        agreement_ui_version = 'v1.0'
      } = req.body;

      if (!userId || !target_id || !signature_name) {
        return res.status(400).json({ error: 'Missing signature details' });
      }

      let scoutId = target_type === 'scout' ? target_id : (req.body.scout_id || null);
      let projectId = req.body.project_id || null;
      let counterpartyOrgId = req.body.counterparty_org_id || null;

      if (target_type === 'scout' && target_id) {
        const scout = db.prepare('SELECT project_id, sender_id FROM scouts WHERE id = ?').get(target_id) as any;
        if (scout) {
          if (!projectId) projectId = scout.project_id;
          if (!counterpartyOrgId) counterpartyOrgId = scout.sender_id;
        }
      }

      let snapTitle = inputTitle;
      let snapBody = inputBody;

      // If snapshot_body wasn't explicitly supplied, capture snapshot from specific version or contract template
      if (!snapBody && contract_id) {
        if (Number(contract_id) > 0) {
          const verRec = db.prepare('SELECT title, body FROM contract_versions WHERE contract_id = ? AND version = ?').get(contract_id, contract_version) as any;
          if (verRec) {
            snapTitle = verRec.title;
            snapBody = verRec.body;
          } else {
            const mainRec = db.prepare('SELECT title, body FROM contracts WHERE id = ?').get(contract_id) as any;
            if (mainRec) {
              snapTitle = mainRec.title;
              snapBody = mainRec.body;
            }
          }
        } else if (Number(contract_id) === -1) {
          snapTitle = '標準秘密保持契約書 (NDA)';
          snapBody = `【秘密保持契約書 (NDA)】\n\n本契約は、開示者（甲）と受領者（乙）との間において、本プロジェクトに関する秘密情報の取り扱いについて定めるものです...`;
        } else if (Number(contract_id) === -2) {
          snapTitle = '標準業務委託契約書 (契約案)';
          snapBody = `【業務委託契約書】\n\n委託者（甲）および受託者（乙）は、以下のとおり業務委託契約を締結する...`;
        }
      }

      snapTitle = snapTitle || '契約書 (添付版)';
      snapBody = snapBody || '（契約本文）';
      const contentHash = crypto.createHash('sha256').update(`${snapTitle}\n${snapBody}`).digest('hex');

      const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || '').toString();
      const userAgent = (req.headers['user-agent'] || '').toString();

      const info = db.prepare(`
        INSERT INTO contract_agreements (
          contract_id, contract_version, snapshot_title, snapshot_body, content_hash,
          target_type, target_id, scout_id, project_id, user_id, counterparty_org_id,
          status, signature_name, agreed_at, ip_address, user_agent,
          agreement_method, language, agreement_ui_version, is_revoked, is_void
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, 0, 0)
      `).run(
        contract_id || 0, contract_version, snapTitle, snapBody, contentHash,
        target_type, target_id, scoutId, projectId, userId, counterpartyOrgId,
        status, signature_name, ipAddress, userAgent,
        agreement_method, language, agreement_ui_version
      );

      const agreementId = info.lastInsertRowid;

      // Log in audit trail
      db.prepare(`
        INSERT INTO contract_audit_logs (contract_id, agreement_id, user_id, action, details, ip_address)
        VALUES (?, ?, ?, 'agreed', ?, ?)
      `).run(contract_id || 0, agreementId, userId, `不可変スナップショット保護電子同意完了: 署名名「${signature_name}」 (第${contract_version}版, Hash: ${contentHash.substring(0, 8)}..., Method: ${agreement_method})`, ipAddress);

      // If target_type is scout, send notification to sender
      if (target_type === 'scout') {
        const scout = db.prepare('SELECT * FROM scouts WHERE id = ?').get(target_id) as any;
        if (scout) {
          db.prepare(`
            INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
            VALUES (?, ?, 'scout_agreed', ?, ?, 'scout')
          `).run(scout.sender_id, userId, `スカウト添付契約書（第${contract_version}版）への電子同意が完了しました。`, target_id);
        }
      }

      const created = db.prepare('SELECT * FROM contract_agreements WHERE id = ?').get(agreementId);
      res.json(created);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Electronic agreement failed' });
    }
  });

  // Protect agreed contract snapshots from being updated or overwritten
  app.put('/api/contracts/agreements/:id', (req, res) => {
    return res.status(403).json({
      error: 'immutable_agreement',
      message: '過去に同意された契約書本文は、改ざん防止の法的観点から上書き変更および改変が不可能です。'
    });
  });

  // Get agreements for a target
  app.get('/api/contracts/agreements', (req, res) => {
    try {
      const { target_type, target_id } = req.query;
      if (!target_type || !target_id) {
        return res.status(400).json({ error: 'Missing target_type or target_id' });
      }

      const agreements = db.prepare(`
        SELECT a.*, u.username, u.avatar
        FROM contract_agreements a
        JOIN users u ON a.user_id = u.id
        WHERE a.target_type = ? AND a.target_id = ?
        ORDER BY a.created_at DESC
      `).all(target_type, target_id);

      res.json(agreements);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch agreements' });
    }
  });

  // Get audit logs
  app.get('/api/contracts/audit-logs', (req, res) => {
    try {
      const { contract_id, agreement_id } = req.query;
      let query = 'SELECT l.*, u.username FROM contract_audit_logs l JOIN users u ON l.user_id = u.id WHERE 1=1';
      const params: any[] = [];

      if (contract_id) {
        query += ' AND l.contract_id = ?';
        params.push(contract_id);
      }
      if (agreement_id) {
        query += ' AND l.agreement_id = ?';
        params.push(agreement_id);
      }

      query += ' ORDER BY l.created_at DESC';

      const logs = db.prepare(query).all(...params);
      res.json(logs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // Requirement 21 & 26: Update scout contract text and recalculate hash
  app.put('/api/scouts/:id/contract', (req, res) => {
    try {
      const scoutId = req.params.id;
      const userId = req.headers['x-user-id'];
      const {
        nda_snapshot_title,
        nda_snapshot_body,
        outsourcing_snapshot_title,
        outsourcing_snapshot_body
      } = req.body;

      const scout = db.prepare('SELECT * FROM scouts WHERE id = ?').get(scoutId) as any;
      if (!scout) return res.status(404).json({ error: 'Scout not found' });

      if (scout.sender_id.toString() !== userId?.toString()) {
        return res.status(403).json({ error: 'Only sender organization can edit contract details' });
      }

      let ndaHash = scout.nda_snapshot_hash;
      let outHash = scout.outsourcing_snapshot_hash;

      const finalNdaTitle = nda_snapshot_title !== undefined ? nda_snapshot_title : scout.nda_snapshot_title;
      const finalNdaBody = nda_snapshot_body !== undefined ? nda_snapshot_body : scout.nda_snapshot_body;
      if (finalNdaTitle || finalNdaBody) {
        ndaHash = crypto.createHash('sha256').update(`${finalNdaTitle || ''}\n${finalNdaBody || ''}`).digest('hex');
      }

      const finalOutTitle = outsourcing_snapshot_title !== undefined ? outsourcing_snapshot_title : scout.outsourcing_snapshot_title;
      const finalOutBody = outsourcing_snapshot_body !== undefined ? outsourcing_snapshot_body : scout.outsourcing_snapshot_body;
      if (finalOutTitle || finalOutBody) {
        outHash = crypto.createHash('sha256').update(`${finalOutTitle || ''}\n${finalOutBody || ''}`).digest('hex');
      }

      const newNdaVersion = (finalNdaBody && finalNdaBody !== scout.nda_snapshot_body) ? (scout.nda_snapshot_version || 1) + 1 : (scout.nda_snapshot_version || 1);
      const newOutVersion = (finalOutBody && finalOutBody !== scout.outsourcing_snapshot_body) ? (scout.outsourcing_snapshot_version || 1) + 1 : (scout.outsourcing_snapshot_version || 1);

      // If status was revision_requested, reset status to confirmation_requested so receiver can re-confirm
      let updatedStatus = scout.status;
      if (scout.status === 'revision_requested') {
        updatedStatus = 'confirmation_requested';
      }

      db.prepare(`
        UPDATE scouts
        SET nda_snapshot_title = ?, nda_snapshot_body = ?, nda_snapshot_version = ?, nda_snapshot_hash = ?,
            outsourcing_snapshot_title = ?, outsourcing_snapshot_body = ?, outsourcing_snapshot_version = ?, outsourcing_snapshot_hash = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        finalNdaTitle, finalNdaBody, newNdaVersion, ndaHash,
        finalOutTitle, finalOutBody, newOutVersion, outHash,
        updatedStatus,
        scoutId
      );

      // Log into contract_audit_logs if available
      try {
        db.prepare(`
          INSERT INTO contract_audit_logs (user_id, contract_id, contract_version, action, details)
          VALUES (?, ?, ?, 'contract_updated', ?)
        `).run(userId, scout.outsourcing_contract_id || scout.nda_contract_id || 0, newOutVersion, `組織により契約書が修正され新バージョン (v${newOutVersion}) が作成されました。再確認を要請。`);
      } catch (e) {}

      db.prepare(`
        INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
        VALUES (?, ?, 'scout_contract_updated', '契約文章が組織により修正され、新しいバージョンを作成しました。内容をご確認の上、再同意をお願いします。', ?, 'scout')
      `).run(scout.receiver_id, userId, scoutId);

      const updated = db.prepare('SELECT * FROM scouts WHERE id = ?').get(scoutId);
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update scout contract' });
    }
  });

  // Requirement 26: Scout Contract Revision / Question Request Endpoint
  app.post('/api/scouts/:id/request_revision', (req, res) => {
    try {
      const scoutId = req.params.id;
      const userId = req.headers['x-user-id'];
      const { revision_type, target_clause, comment } = req.body;

      const scout = db.prepare('SELECT * FROM scouts WHERE id = ?').get(scoutId) as any;
      if (!scout) return res.status(404).json({ error: 'Scout not found' });

      if (scout.receiver_id.toString() !== userId?.toString()) {
        return res.status(403).json({ error: 'Only receiver can request contract revisions' });
      }

      if (!target_clause || !comment) {
        return res.status(400).json({ error: '対象条文とコメントを入力してください。' });
      }

      const revType = revision_type === 'question' ? 'question' : 'revision_request';

      db.prepare(`
        UPDATE scouts
        SET status = 'revision_requested',
            revision_type = ?,
            revision_target_clause = ?,
            revision_comment = ?,
            revision_requested_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(revType, target_clause, comment, scoutId);

      const typeLabel = revType === 'question' ? '契約質問' : '修正依頼';
      const notifMsg = `契約内容に関する${typeLabel}が届きました（対象条文: ${target_clause}）: 「${comment}」`;

      db.prepare(`
        INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
        VALUES (?, ?, 'contract_revision_requested', ?, ?, 'scout')
      `).run(scout.sender_id, userId, notifMsg, scoutId);

      // Audit log
      try {
        db.prepare(`
          INSERT INTO contract_audit_logs (user_id, contract_id, contract_version, action, details)
          VALUES (?, ?, 1, 'revision_requested', ?)
        `).run(userId, scout.outsourcing_contract_id || scout.nda_contract_id || 0, `【${typeLabel}】対象: ${target_clause} / コメント: ${comment}`);
      } catch (e) {}

      const updated = db.prepare('SELECT * FROM scouts WHERE id = ?').get(scoutId);
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to submit revision request' });
    }
  });

  app.put('/api/scouts/:id/status', (req, res) => {
    try {
      const scoutId = req.params.id;
      const { status, hold_reason, decline_reason } = req.body;
      const userId = req.headers['x-user-id'];
      
      const scout = db.prepare('SELECT * FROM scouts WHERE id = ?').get(scoutId) as any;
      if (!scout) return res.status(404).json({ error: 'Not found' });
      
      if (scout.receiver_id.toString() !== userId?.toString() && scout.sender_id.toString() !== userId?.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db.prepare('UPDATE scouts SET status = ?, hold_reason = COALESCE(?, hold_reason), decline_reason = COALESCE(?, decline_reason), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, hold_reason || null, decline_reason || null, scoutId);
      
      if (status === 'accepted') {
         db.prepare('INSERT INTO notifications (user_id, from_user_id, type, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(scout.sender_id, scout.receiver_id, 'scout_accepted', scout.id, 'scout');
         db.prepare('INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)').run(scout.receiver_id, scout.sender_id);
         db.prepare('INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)').run(scout.sender_id, scout.receiver_id);

         if (scout.source_type === 'recruitment' && scout.recruitment_id && scout.idea_id) {
           db.prepare(`
             INSERT INTO idea_selection_statuses (recruitment_id, idea_id, org_id, status, updated_at)
             VALUES (?, ?, ?, 'accepted', CURRENT_TIMESTAMP)
             ON CONFLICT(recruitment_id, idea_id, org_id) DO UPDATE SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
           `).run(scout.recruitment_id, scout.idea_id, scout.sender_id);
         } else if (scout.source_type === 'offer' && scout.offer_id) {
           db.prepare(`
             INSERT INTO offer_statuses (offer_id, org_id, status, updated_at)
             VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP)
             ON CONFLICT(offer_id, org_id) DO UPDATE SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
           `).run(scout.offer_id, scout.sender_id);
         }

         // Ensure both receiver and sender are added to chat membership (idea_follows & permitted_users)
         const addUserToChat = (targetId: number, targetType: 'project' | 'idea') => {
           const uids = [scout.receiver_id, scout.sender_id];
           for (const uid of uids) {
             if (!uid) continue;
             if (targetType === 'project') {
               const proj = db.prepare('SELECT author_id, permitted_users FROM projects WHERE id = ?').get(targetId) as any;
               if (proj) {
                 if (proj.author_id != uid) {
                   const existing = db.prepare('SELECT id FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(targetId, uid) as any;
                   if (existing) {
                     db.prepare("UPDATE idea_follows SET is_mutual = 1, status = 'approved', role = COALESCE(?, role) WHERE id = ?").run(scout.role || 'メンバー', existing.id);
                   } else {
                     db.prepare("INSERT INTO idea_follows (project_id, follower_id, is_mutual, status, role, reason) VALUES (?, ?, 1, 'approved', ?, '指名スカウト')").run(targetId, uid, scout.role || 'メンバー');
                   }
                 } else {
                   db.prepare('DELETE FROM idea_follows WHERE project_id = ? AND follower_id = ?').run(targetId, uid);
                 }
                 let pList: number[] = [];
                 try { pList = JSON.parse(proj.permitted_users || '[]'); } catch (e) {}
                 if (!pList.includes(Number(uid))) {
                   pList.push(Number(uid));
                   db.prepare('UPDATE projects SET permitted_users = ? WHERE id = ?').run(JSON.stringify(pList), targetId);
                 }
               }
             } else {
               const idea = db.prepare('SELECT author_id, permitted_users, quoted_item_id, quoted_item_type FROM ideas WHERE id = ?').get(targetId) as any;
               if (idea) {
                 if (idea.author_id != uid) {
                   const existing = db.prepare('SELECT id FROM idea_follows WHERE idea_id = ? AND follower_id = ?').get(targetId, uid) as any;
                   if (existing) {
                     db.prepare("UPDATE idea_follows SET is_mutual = 1, status = 'approved', role = COALESCE(?, role) WHERE id = ?").run(scout.role || 'メンバー', existing.id);
                   } else {
                     db.prepare("INSERT INTO idea_follows (idea_id, follower_id, is_mutual, status, role, reason) VALUES (?, ?, 1, 'approved', ?, '指名スカウト')").run(targetId, uid, scout.role || 'メンバー');
                   }
                 } else {
                   db.prepare('DELETE FROM idea_follows WHERE idea_id = ? AND follower_id = ?').run(targetId, uid);
                 }
                 let pList: number[] = [];
                 try { pList = JSON.parse(idea.permitted_users || '[]'); } catch (e) {}
                 if (!pList.includes(Number(uid))) {
                   pList.push(Number(uid));
                   db.prepare('UPDATE ideas SET permitted_users = ? WHERE id = ?').run(JSON.stringify(pList), targetId);
                 }
                 let rootP = idea.quoted_item_id && idea.quoted_item_type ? getRootProject(idea.quoted_item_id, idea.quoted_item_type) : null;
                 if (!rootP && idea.quoted_item_type === 'project') rootP = idea.quoted_item_id;
                 if (rootP) {
                   const rootProj = db.prepare('SELECT author_id, permitted_users FROM projects WHERE id = ?').get(rootP) as any;
                   if (rootProj) {
                     if (rootProj.author_id != uid) {
                       const projExist = db.prepare('SELECT id FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(rootP, uid) as any;
                       if (projExist) {
                         db.prepare("UPDATE idea_follows SET is_mutual = 1, status = 'approved', role = COALESCE(?, role) WHERE id = ?").run(scout.role || 'メンバー', projExist.id);
                       } else {
                         db.prepare("INSERT INTO idea_follows (project_id, follower_id, is_mutual, status, role, reason) VALUES (?, ?, 1, 'approved', ?, '指名スカウト')").run(rootP, uid, scout.role || 'メンバー');
                       }
                     } else {
                       db.prepare('DELETE FROM idea_follows WHERE project_id = ? AND follower_id = ?').run(rootP, uid);
                     }
                     let rootPList: number[] = [];
                     try { rootPList = JSON.parse(rootProj.permitted_users || '[]'); } catch(e) {}
                     if (!rootPList.includes(Number(uid))) {
                       rootPList.push(Number(uid));
                       db.prepare('UPDATE projects SET permitted_users = ? WHERE id = ?').run(JSON.stringify(rootPList), rootP);
                     }
                   }
                 }
               }
             }
           }
         };

         if (scout.project_id) {
           addUserToChat(scout.project_id, 'project');
         }
         if (scout.recruitment_id) {
           const p = db.prepare('SELECT id FROM projects WHERE id = ?').get(scout.recruitment_id);
           if (p) addUserToChat(scout.recruitment_id, 'project');
           const i = db.prepare('SELECT id FROM ideas WHERE id = ?').get(scout.recruitment_id);
           if (i) addUserToChat(scout.recruitment_id, 'idea');
         }
         if (scout.offer_id) {
           const p = db.prepare('SELECT id FROM projects WHERE id = ?').get(scout.offer_id);
           if (p) addUserToChat(scout.offer_id, 'project');
           const i = db.prepare('SELECT id FROM ideas WHERE id = ?').get(scout.offer_id);
           if (i) addUserToChat(scout.offer_id, 'idea');
         }
         if (scout.idea_id) {
           addUserToChat(scout.idea_id, 'idea');
         }
         if (scout.reference_item_id && (scout.reference_item_type === 'project' || scout.reference_item_type === 'idea')) {
           addUserToChat(scout.reference_item_id, scout.reference_item_type as 'project' | 'idea');
         }
      } else if (status === 'on_hold') {
         db.prepare('INSERT INTO notifications (user_id, from_user_id, type, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(scout.sender_id, scout.receiver_id, 'scout_on_hold', scout.id, 'scout');
      } else if (status === 'declined') {
         db.prepare('INSERT INTO notifications (user_id, from_user_id, type, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(scout.sender_id, scout.receiver_id, 'scout_declined', scout.id, 'scout');

         if (scout.source_type === 'recruitment' && scout.recruitment_id && scout.idea_id) {
           db.prepare(`
             INSERT INTO idea_selection_statuses (recruitment_id, idea_id, org_id, status, updated_at)
             VALUES (?, ?, ?, 'declined', CURRENT_TIMESTAMP)
             ON CONFLICT(recruitment_id, idea_id, org_id) DO UPDATE SET status = 'declined', updated_at = CURRENT_TIMESTAMP
           `).run(scout.recruitment_id, scout.idea_id, scout.sender_id);
         } else if (scout.source_type === 'offer' && scout.offer_id) {
           db.prepare(`
             INSERT INTO offer_statuses (offer_id, org_id, status, updated_at)
             VALUES (?, ?, 'declined', CURRENT_TIMESTAMP)
             ON CONFLICT(offer_id, org_id) DO UPDATE SET status = 'declined', updated_at = CURRENT_TIMESTAMP
           `).run(scout.offer_id, scout.sender_id);
         }
      }

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/api/scouts/generate', async (req, res) => {
    try {
      const { targetUsername, targetTags, targetIdeas, targetRole, period, reward, orgName, orgProjects } = req.body;
      const language = req.body.language || 'ja';
      
      const prompt = `
        You are an AI assistant helping an organization craft a personalized scout message on the E-hub platform.
        Draft a polite, professional, and personalized scout message based on the following details.
        DO NOT invent any skills, background, or achievements that are not explicitly stated. Avoid aggressive sales pitches.
        
        Organization Name: ${orgName}
        Target User Name: ${targetUsername}
        Target User Interests/Tags: ${targetTags}
        Target User Ideas/Projects: ${targetIdeas}
        Requested Role: ${targetRole}
        Expected Period: ${period}
        Reward terms: ${reward}
        Org Projects Context: ${orgProjects}
        
        Output only the scout message text in ${language === 'ja' ? 'Japanese' : 'English'}, without any markdown code blocks or extra explanations.
      `;
      
      let text = '';
      try {
        const response = { text: await generateText(prompt) };
        text = response.text || '';
      } catch (openaiError) {
        console.warn('OpenAI failed for scout generate:', openaiError.message);
        try {
          const apiRes = await requestAIText({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'user', content: prompt }
              ]
            })
          });
          if (apiRes.ok) {
            text = await apiRes.text();
          } else {
             throw new Error('OpenAI failed');
          }
        } catch (err) {
           text = language === 'ja' 
             ? `[${orgName}] より、${targetUsername} 様のプロフィールを拝見し、ぜひ一度お話ししたくご連絡いたしました。募集ポジション: ${targetRole}`
             : `Hi ${targetUsername}, we at ${orgName} are impressed by your profile and would like to discuss a ${targetRole} role with you.`;
        }
      }
      res.json({ text });
    } catch (e) {
      console.error('Error generating scout text:', e);
      res.status(500).json({ error: 'Failed to generate' });
    }
  });

  app.put('/api/users/:id/scout_setting', (req, res) => {
    try {
      const { setting } = req.body;
      const userId = req.headers['x-user-id'];
      if (userId !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
      db.prepare('UPDATE users SET scout_setting = ? WHERE id = ?').run(setting, userId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ==========================================
  // E-hub Project Contract Endpoints (項目1〜78)
  // ==========================================

  // 1. Get user's project contracts
  app.get('/api/project-contracts', (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.user_id;
      const projectId = req.query.project_id;
      const ideaId = req.query.idea_id;

      let query = `
        SELECT pc.*,
               org.username as organization_name, org.avatar as organization_avatar, org.account_type as organization_account_type,
               ind.username as individual_name, ind.avatar as individual_avatar,
               p.title as project_title, i.title as idea_title
        FROM project_contracts pc
        LEFT JOIN users org ON pc.organization_account_id = org.id
        LEFT JOIN users ind ON pc.individual_account_id = ind.id
        LEFT JOIN projects p ON pc.project_id = p.id
        LEFT JOIN ideas i ON pc.idea_id = i.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (projectId) {
        query += ` AND pc.project_id = ?`;
        params.push(projectId);
      }
      if (ideaId) {
        query += ` AND pc.idea_id = ?`;
        params.push(ideaId);
      }
      if (userId) {
        query += ` AND (pc.organization_account_id = ? OR pc.individual_account_id = ?)`;
        params.push(userId, userId);
      }

      query += ` ORDER BY pc.updated_at DESC, pc.id DESC`;

      const contracts = db.prepare(query).all(...params);
      res.json(contracts);
    } catch (e) {
      console.error('Error fetching project contracts:', e);
      res.status(500).json({ error: 'Failed to fetch project contracts' });
    }
  });

  // 2. Get single project contract by ID with version history
  app.get('/api/project-contracts/:id', (req, res) => {
    try {
      const contractId = req.params.id;
      const contract = db.prepare(`
        SELECT pc.*,
               org.username as organization_name, org.avatar as organization_avatar, org.account_type as organization_account_type,
               ind.username as individual_name, ind.avatar as individual_avatar,
               ind.stripe_account_id as individual_stripe_account_id,
               p.title as project_title, i.title as idea_title
        FROM project_contracts pc
        LEFT JOIN users org ON pc.organization_account_id = org.id
        LEFT JOIN users ind ON pc.individual_account_id = ind.id
        LEFT JOIN projects p ON pc.project_id = p.id
        LEFT JOIN ideas i ON pc.idea_id = i.id
        WHERE pc.id = ?
      `).get(contractId) as any;

      if (!contract) return res.status(404).json({ error: 'Project contract not found' });

      // Fetch version history
      const versions = db.prepare(`
        SELECT pcv.*, u.username as changed_by_name
        FROM project_contract_versions pcv
        LEFT JOIN users u ON pcv.changed_by_user_id = u.id
        WHERE pcv.contract_id = ?
        ORDER BY pcv.contract_version DESC
      `).all(contractId);

      // Fetch audit logs
      const auditLogs = db.prepare(`
        SELECT al.*, u.username as user_name
        FROM project_contract_audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.contract_id = ?
        ORDER BY al.created_at DESC
      `).all(contractId);

      res.json({
        ...contract,
        versions,
        auditLogs
      });
    } catch (e) {
      console.error('Error fetching project contract:', e);
      res.status(500).json({ error: 'Failed to fetch project contract' });
    }
  });

  // 3. Create new project contract
  app.post('/api/project-contracts', (req, res) => {
    try {
      const userId = Number(req.headers['x-user-id'] || req.body.user_id);
      const {
        project_id,
        idea_id,
        organization_account_id,
        individual_account_id,
        project_contract_type = 'participation',
        legal_contract_type,
        title,
        role,
        objective,
        scope_of_work,
        deliverables,
        delivery_date,
        start_date,
        end_date,
        duration,
        activity_scale,
        compensation_types = '["fixed"]',
        gross_amount = 0,
        initial_reward_amount = 0,
        performance_reward_amount = 0,
        revenue_share_rate = 0,
        revenue_share_period,
        revenue_share_target,
        cost_burden,
        ip_rights,
        termination_conditions,
        payment_cycle = 'monthly',
        payment_due_date,
        inspection_conditions,
        nda_required = 0,
        nda_body,
        contract_body,
        requires_offplatform_procedure,
        currency = 'jpy'
      } = req.body;

      if (!organization_account_id || !individual_account_id) {
        return res.status(400).json({ error: 'organization_account_id and individual_account_id are required' });
      }

      // Check if organization account is municipality to default requires_offplatform_procedure = 1
      let reqOffplatform = requires_offplatform_procedure !== undefined ? (requires_offplatform_procedure ? 1 : 0) : 0;
      if (requires_offplatform_procedure === undefined) {
        const orgUser = db.prepare('SELECT account_type FROM users WHERE id = ?').get(organization_account_id) as any;
        if (orgUser && orgUser.account_type === 'municipality') {
          reqOffplatform = 1;
        }
      }

      // 項目13, 14: E-hub成功報酬は組織側課金(5%)、個人側成功報酬は0%(契約報酬100%全額受取)
      const numGross = Number(gross_amount) || 0;
      const orgFeeRate = 0.05; // 組織側5%
      const orgFeeAmount = Math.round(numGross * orgFeeRate);
      const organizationTotal = numGross + orgFeeAmount; // 組織支払総額
      const individualNetAmount = numGross; // 個人受取金額 (100%全額)

      // Determine default legal contract type if not specified
      let finalLegalType = legal_contract_type;
      if (!finalLegalType) {
        if (project_contract_type === 'participation') finalLegalType = 'outsourcing_quasi_mandate';
        else if (project_contract_type === 'completion') finalLegalType = 'outsourcing_contract';
        else finalLegalType = 'joint_venture';
      }

      const compTypesJson = typeof compensation_types === 'string' ? compensation_types : JSON.stringify(compensation_types);

      const stmt = db.prepare(`
        INSERT INTO project_contracts (
          project_id, idea_id, organization_account_id, individual_account_id,
          project_contract_type, legal_contract_type, title, role, objective,
          scope_of_work, deliverables, delivery_date, start_date, end_date, duration,
          activity_scale, compensation_types, gross_amount, platform_fee_rate,
          platform_fee_amount, organization_total_amount, individual_net_amount, initial_reward_amount,
          performance_reward_amount, revenue_share_rate, revenue_share_period,
          revenue_share_target, cost_burden, ip_rights, termination_conditions,
          payment_cycle, payment_due_date, inspection_conditions, nda_required,
          nda_body, contract_body, currency, requires_offplatform_procedure, contract_status, payment_status, contract_version
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, 'draft', 'unpaid', 1
        )
      `);

      const info = stmt.run(
        project_id || null, idea_id || null, organization_account_id, individual_account_id,
        project_contract_type, finalLegalType, title || 'Project Contract', role || '', objective || '',
        scope_of_work || '', deliverables || '', delivery_date || null, start_date || null, end_date || null, duration || '',
        activity_scale || '', compTypesJson, numGross, orgFeeRate,
        orgFeeAmount, organizationTotal, individualNetAmount, Number(initial_reward_amount) || 0,
        Number(performance_reward_amount) || 0, Number(revenue_share_rate) || 0, revenue_share_period || '',
        revenue_share_target || '', cost_burden || '', ip_rights || '', termination_conditions || '',
        payment_cycle, payment_due_date || '', inspection_conditions || '', nda_required ? 1 : 0,
        nda_body || '', contract_body || '', currency || 'jpy', reqOffplatform
      );

      const contractId = info.lastInsertRowid;

      // Save initial version snapshot
      const createdContract = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId);
      db.prepare(`
        INSERT INTO project_contract_versions (contract_id, contract_version, changed_by_user_id, snapshot_json, change_summary)
        VALUES (?, 1, ?, ?, '初期契約案の作成')
      `).run(contractId, userId || organization_account_id, JSON.stringify(createdContract));

      // Audit log
      const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || '').toString();
      db.prepare(`
        INSERT INTO project_contract_audit_logs (contract_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'created', 'Project Contract案が作成されました。', ?)
      `).run(contractId, userId || organization_account_id, ipAddress);

      // Send notification to counterparty
      const recipientId = userId === organization_account_id ? individual_account_id : organization_account_id;
      db.prepare(`
        INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
        VALUES (?, ?, 'project_contract_created', '新しいProject Contractの提案が届きました。内容をご確認ください。', ?, 'project_contract')
      `).run(recipientId, userId || organization_account_id, contractId);
      io.to(`user:${recipientId}`).emit('notification');

      res.status(201).json(createdContract);
    } catch (e) {
      console.error('Error creating project contract:', e);
      res.status(500).json({ error: 'Failed to create project contract' });
    }
  });

  // 4. Update project contract (with versioning & agreement reset on key terms modification)
  app.put('/api/project-contracts/:id', (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = Number(req.headers['x-user-id'] || req.body.user_id);
      const existing = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId) as any;

      if (!existing) return res.status(404).json({ error: 'Project contract not found' });
      if (existing.contract_status === 'active' || existing.contract_status === 'completed') {
        return res.status(400).json({ error: '契約成立後は直接編集できません。変更には双方の再同意手続きが必要です。' });
      }

      const {
        project_contract_type,
        legal_contract_type,
        title,
        role,
        objective,
        scope_of_work,
        deliverables,
        delivery_date,
        start_date,
        end_date,
        duration,
        activity_scale,
        compensation_types,
        gross_amount,
        initial_reward_amount,
        performance_reward_amount,
        revenue_share_rate,
        revenue_share_period,
        revenue_share_target,
        cost_burden,
        ip_rights,
        termination_conditions,
        payment_cycle,
        payment_due_date,
        inspection_conditions,
        nda_required,
        nda_body,
        contract_body,
        currency,
        requires_offplatform_procedure,
        change_summary
      } = req.body;

      // 項目13, 14: E-hub成功報酬は組織側課金(5%)、個人側成功報酬は0%(契約報酬100%全額受取)
      const numGross = gross_amount !== undefined ? Number(gross_amount) : existing.gross_amount;
      const orgFeeRate = 0.05;
      const orgFeeAmount = Math.round(numGross * orgFeeRate);
      const organizationTotal = numGross + orgFeeAmount;
      const individualNetAmount = numGross;

      const compTypesJson = compensation_types !== undefined
        ? (typeof compensation_types === 'string' ? compensation_types : JSON.stringify(compensation_types))
        : existing.compensation_types;

      const nextVersion = (existing.contract_version || 1) + 1;

      db.prepare(`
        UPDATE project_contracts
        SET project_contract_type = COALESCE(?, project_contract_type),
            legal_contract_type = COALESCE(?, legal_contract_type),
            title = COALESCE(?, title),
            role = COALESCE(?, role),
            objective = COALESCE(?, objective),
            scope_of_work = COALESCE(?, scope_of_work),
            deliverables = COALESCE(?, deliverables),
            delivery_date = COALESCE(?, delivery_date),
            start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date),
            duration = COALESCE(?, duration),
            activity_scale = COALESCE(?, activity_scale),
            compensation_types = COALESCE(?, compensation_types),
            gross_amount = ?,
            platform_fee_rate = ?,
            platform_fee_amount = ?,
            organization_total_amount = ?,
            individual_net_amount = ?,
            initial_reward_amount = COALESCE(?, initial_reward_amount),
            performance_reward_amount = COALESCE(?, performance_reward_amount),
            revenue_share_rate = COALESCE(?, revenue_share_rate),
            revenue_share_period = COALESCE(?, revenue_share_period),
            revenue_share_target = COALESCE(?, revenue_share_target),
            cost_burden = COALESCE(?, cost_burden),
            ip_rights = COALESCE(?, ip_rights),
            termination_conditions = COALESCE(?, termination_conditions),
            payment_cycle = COALESCE(?, payment_cycle),
            payment_due_date = COALESCE(?, payment_due_date),
            inspection_conditions = COALESCE(?, inspection_conditions),
            nda_required = COALESCE(?, nda_required),
            nda_body = COALESCE(?, nda_body),
            contract_body = COALESCE(?, contract_body),
            currency = COALESCE(?, currency),
            requires_offplatform_procedure = COALESCE(?, requires_offplatform_procedure),
            contract_version = ?,
            organization_agreed_at = NULL, -- Reset agreement on terms change
            individual_agreed_at = NULL,
            contract_status = 'draft',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        project_contract_type || null, legal_contract_type || null, title || null, role || null, objective || null,
        scope_of_work || null, deliverables || null, delivery_date || null, start_date || null, end_date || null, duration || null,
        activity_scale || null, compTypesJson || null, numGross, orgFeeRate,
        orgFeeAmount, organizationTotal, individualNetAmount, initial_reward_amount !== undefined ? Number(initial_reward_amount) : null,
        performance_reward_amount !== undefined ? Number(performance_reward_amount) : null, revenue_share_rate !== undefined ? Number(revenue_share_rate) : null,
        revenue_share_period || null, revenue_share_target || null, cost_burden || null, ip_rights || null,
        termination_conditions || null, payment_cycle || null, payment_due_date || null, inspection_conditions || null,
        nda_required !== undefined ? (nda_required ? 1 : 0) : null, nda_body || null, contract_body || null, currency || null,
        requires_offplatform_procedure !== undefined ? (requires_offplatform_procedure ? 1 : 0) : null,
        nextVersion, contractId
      );

      const updated = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId);

      // Record new version history
      db.prepare(`
        INSERT INTO project_contract_versions (contract_id, contract_version, changed_by_user_id, snapshot_json, change_summary)
        VALUES (?, ?, ?, ?, ?)
      `).run(contractId, nextVersion, userId || existing.organization_account_id, JSON.stringify(updated), change_summary || `第${nextVersion}版への条件更新`);

      // Audit log
      const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || '').toString();
      db.prepare(`
        INSERT INTO project_contract_audit_logs (contract_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'updated', ?, ?)
      `).run(contractId, userId || existing.organization_account_id, `契約条件が更新されました（Ver.${nextVersion}）。`, ipAddress);

      // Notify counterparty
      const recipientId = userId === existing.organization_account_id ? existing.individual_account_id : existing.organization_account_id;
      db.prepare(`
        INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
        VALUES (?, ?, 'project_contract_updated', 'Project Contractの条件が更新されました。再確認と同意をお願いします。', ?, 'project_contract')
      `).run(recipientId, userId || existing.organization_account_id, contractId);
      io.to(`user:${recipientId}`).emit('notification');

      res.json(updated);
    } catch (e) {
      console.error('Error updating project contract:', e);
      res.status(500).json({ error: 'Failed to update project contract' });
    }
  });

  // 5. Agree to Project Contract (Both sides must agree -> awaiting_payment)
  app.post('/api/project-contracts/:id/agree', (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = Number(req.headers['x-user-id'] || req.body.user_id);
      const contract = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId) as any;

      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      const isOrg = userId === contract.organization_account_id;
      const isInd = userId === contract.individual_account_id;

      if (!isOrg && !isInd) {
        return res.status(403).json({ error: 'この契約の当事者のみ同意できます。' });
      }

      let orgAgreedAt = contract.organization_agreed_at;
      let indAgreedAt = contract.individual_agreed_at;

      if (isOrg) orgAgreedAt = new Date().toISOString();
      if (isInd) indAgreedAt = new Date().toISOString();

      let newStatus = contract.contract_status;
      // If both agreed, transition to 'awaiting_payment' (項目43: 双方同意だけではactiveにせず、決済待ちにする)
      if (orgAgreedAt && indAgreedAt) {
        newStatus = 'awaiting_payment';
      }

      db.prepare(`
        UPDATE project_contracts
        SET organization_agreed_at = ?,
            individual_agreed_at = ?,
            contract_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(orgAgreedAt, indAgreedAt, newStatus, contractId);

      // Audit log
      const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || '').toString();
      db.prepare(`
        INSERT INTO project_contract_audit_logs (contract_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'agreed', ?, ?)
      `).run(contractId, userId, `${isOrg ? '組織' : '個人'}側が契約条件に同意しました。`, ipAddress);

      // Notify counterparty
      const counterpartyId = isOrg ? contract.individual_account_id : contract.organization_account_id;
      const agreeMsg = newStatus === 'awaiting_payment'
        ? '双方の同意が完了しました。組織による決済完了後にProject Contractが正式成立します。'
        : `${isOrg ? '組織' : '個人'}が契約条件に同意しました。`;

      db.prepare(`
        INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
        VALUES (?, ?, 'project_contract_agreed', ?, ?, 'project_contract')
      `).run(counterpartyId, userId, agreeMsg, contractId);
      io.to(`user:${counterpartyId}`).emit('notification');

      const updated = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId);
      res.json(updated);
    } catch (e) {
      console.error('Error agreeing to project contract:', e);
      res.status(500).json({ error: 'Failed to agree to project contract' });
    }
  });

  // Helper function to activate project contract and open Project Chat
  function activateProjectContract(contractId: number, paymentId?: string) {
    const contract = db.prepare(`
      SELECT pc.*,
             org.username as organization_name,
             ind.username as individual_name,
             p.title as project_title,
             i.title as idea_title
      FROM project_contracts pc
      LEFT JOIN users org ON pc.organization_account_id = org.id
      LEFT JOIN users ind ON pc.individual_account_id = ind.id
      LEFT JOIN projects p ON pc.project_id = p.id
      LEFT JOIN ideas i ON pc.idea_id = i.id
      WHERE pc.id = ?
    `).get(contractId) as any;

    if (!contract) return null;

    // Prevent double processing (項目56: 二重決済・二重処理防止)
    if (contract.contract_status === 'active' && contract.payment_status === 'paid') {
      return contract;
    }

    // 1. Mark contract as active & paid
    db.prepare(`
      UPDATE project_contracts
      SET contract_status = 'active',
          payment_status = 'paid',
          paid_at = CURRENT_TIMESTAMP,
          contract_started_at = CURRENT_TIMESTAMP,
          stripe_payment_id = COALESCE(?, stripe_payment_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(paymentId || null, contractId);

    // 2. Grant project/idea chat access & ensure members in idea_follows
    const orgId = contract.organization_account_id;
    const indId = contract.individual_account_id;
    const targetProjectId = contract.project_id;
    const targetIdeaId = contract.idea_id;

    // Ensure follow/member relationship
    db.prepare('INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)').run(orgId, indId);
    db.prepare('INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)').run(indId, orgId);

    if (targetProjectId) {
      const projExist = db.prepare('SELECT id FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(targetProjectId, indId) as any;
      if (projExist) {
        db.prepare("UPDATE idea_follows SET is_mutual = 1, status = 'approved', role = COALESCE(?, role) WHERE id = ?").run(contract.role || 'Projectメンバー', projExist.id);
      } else {
        db.prepare("INSERT INTO idea_follows (project_id, follower_id, is_mutual, status, role, reason) VALUES (?, ?, 1, 'approved', ?, 'Project Contract')").run(targetProjectId, indId, contract.role || 'Projectメンバー');
      }

      // Add to permitted_users list
      const proj = db.prepare('SELECT permitted_users FROM projects WHERE id = ?').get(targetProjectId) as any;
      if (proj) {
        let pList: number[] = [];
        try { pList = JSON.parse(proj.permitted_users || '[]'); } catch (e) {}
        if (!pList.includes(indId)) pList.push(indId);
        if (!pList.includes(orgId)) pList.push(orgId);
        db.prepare('UPDATE projects SET permitted_users = ? WHERE id = ?').run(JSON.stringify(pList), targetProjectId);
      }
    }

    if (targetIdeaId) {
      const ideaExist = db.prepare('SELECT id FROM idea_follows WHERE idea_id = ? AND follower_id = ?').get(targetIdeaId, orgId) as any;
      if (ideaExist) {
        db.prepare("UPDATE idea_follows SET is_mutual = 1, status = 'approved' WHERE id = ?").run(ideaExist.id);
      } else {
        db.prepare("INSERT INTO idea_follows (idea_id, follower_id, is_mutual, status, role, reason) VALUES (?, ?, 1, 'approved', 'Partner', 'Project Contract')").run(targetIdeaId, orgId);
      }

      const idea = db.prepare('SELECT permitted_users FROM ideas WHERE id = ?').get(targetIdeaId) as any;
      if (idea) {
        let pList: number[] = [];
        try { pList = JSON.parse(idea.permitted_users || '[]'); } catch (e) {}
        if (!pList.includes(indId)) pList.push(indId);
        if (!pList.includes(orgId)) pList.push(orgId);
        db.prepare('UPDATE ideas SET permitted_users = ? WHERE id = ?').run(JSON.stringify(pList), targetIdeaId);
      }
    }

    // 3. Post initial compact card message into chat (項目45, 46)
    const typeLabel = contract.project_contract_type === 'participation' ? '一緒に進める（Project参加型）'
      : contract.project_contract_type === 'completion' ? '完成させる（成果完成型）'
      : '一緒につくる（共同事業型）';

    const rewardSummary = contract.gross_amount > 0 ? `¥${contract.gross_amount.toLocaleString()}` : '条件設定通り';

    const initialCardMsg = `【Project Contract成立】\n🎉 決済が完了し契約が成立しました！\n\n・進め方: ${typeLabel}\n・期間: ${contract.duration || '条件通り'}\n・報酬: ${rewardSummary}\n\nProject Chatが解放されました。よろしくお願いいたします！`;

    if (targetProjectId) {
      db.prepare(`
        INSERT INTO chats (project_id, user_id, message)
        VALUES (?, ?, ?)
      `).run(targetProjectId, orgId, initialCardMsg);
      io.to(`project:${targetProjectId}`).emit('chat_message');
    } else if (targetIdeaId) {
      db.prepare(`
        INSERT INTO chats (idea_id, user_id, message)
        VALUES (?, ?, ?)
      `).run(targetIdeaId, orgId, initialCardMsg);
      io.to(`idea:${targetIdeaId}`).emit('chat_message');
    }

    // 4. Notifications to both parties
    db.prepare(`
      INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
      VALUES (?, ?, 'project_contract_active', 'Project Contractが成立しました！Project Chatが利用可能です。', ?, 'project_contract')
    `).run(orgId, indId, contractId);

    db.prepare(`
      INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
      VALUES (?, ?, 'project_contract_active', 'Project Contractが成立しました！Project Chatが利用可能です。', ?, 'project_contract')
    `).run(indId, orgId, contractId);

    io.to(`user:${orgId}`).emit('notification');
    io.to(`user:${indId}`).emit('notification');

    // Audit log
    db.prepare(`
      INSERT INTO project_contract_audit_logs (contract_id, user_id, action, details)
      VALUES (?, ?, 'activated', '組織決済が確認され、Project Contractが正式成立しました。')
    `).run(contractId, orgId);

    return db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId);
  }

  // 6. Create Stripe Checkout Session for Project Contract (項目39, 40, 56)
  app.post('/api/project-contracts/:id/checkout', async (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = Number(req.headers['x-user-id'] || req.body.user_id);
      const contract = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId) as any;

      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      if (contract.organization_account_id !== userId) {
        return res.status(403).json({ error: 'Only the organization can pay for this contract' });
      }

      // Check double payment (項目56)
      if (contract.payment_status === 'paid' || contract.contract_status === 'active') {
        return res.status(400).json({ error: 'この契約はすでに決済済みです。' });
      }

      const stripe = getStripe();
      const numGross = Math.round(contract.gross_amount || 10000);
      const orgFee = Math.round(contract.platform_fee_amount || (numGross * 0.05));
      const amount = Math.max(50, Math.round(contract.organization_total_amount || (numGross + orgFee)));

      if (!stripe) {
        // Fallback / mock mode for development preview (TEST MODE)
        const updated = activateProjectContract(Number(contractId), 'mock_test_pay_' + Date.now());
        return res.json({
          mock: true,
          success: true,
          message: 'TEST MODE: 決済がシミュレーションされ契約が成立しました。',
          contract: updated
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: `E-hub Project Contract: ${contract.title || 'プロジェクト型雇用契約'}`,
                description: `進め方: ${contract.project_contract_type === 'participation' ? '一緒に進める' : contract.project_contract_type === 'completion' ? '完成させる' : '一緒につくる'} (契約報酬 ¥${numGross.toLocaleString()} + E-hub手数料5% ¥${orgFee.toLocaleString()})`
              },
              unit_amount: amount
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        metadata: {
          project_contract_id: contractId.toString(),
          organization_id: contract.organization_account_id.toString(),
          individual_id: contract.individual_account_id.toString(),
          type: 'project_contract'
        },
        success_url: `${req.headers.origin || 'http://localhost:3000'}/contracts?payment_success=true&contract_id=${contractId}`,
        cancel_url: `${req.headers.origin || 'http://localhost:3000'}/contracts?payment_cancelled=true&contract_id=${contractId}`
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (e: any) {
      console.error('Error creating contract checkout:', e);
      res.status(500).json({ error: e.message || 'Failed to create checkout session' });
    }
  });

  // 7. Simulate/Test payment completion (for development & testing in TEST MODE - 項目49)
  app.post('/api/project-contracts/:id/simulate-payment', (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const updated = activateProjectContract(contractId, 'sim_test_pay_' + Date.now());
      if (!updated) return res.status(404).json({ error: 'Contract not found' });
      res.json({ success: true, contract: updated });
    } catch (e) {
      console.error('Error simulating payment:', e);
      res.status(500).json({ error: 'Failed to simulate payment' });
    }
  });

  // 8. Complete Service / Inspection (成果・役務確認 -> 支払条件成立) (項目41, 42)
  app.post('/api/project-contracts/:id/complete-service', (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = Number(req.headers['x-user-id'] || req.body.user_id);
      const contract = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId) as any;

      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      if (contract.organization_account_id !== userId && contract.individual_account_id !== userId) {
        return res.status(403).json({ error: '当事者のみ操作可能です。' });
      }

      db.prepare(`
        UPDATE project_contracts
        SET service_completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(contractId);

      // Audit log
      db.prepare(`
        INSERT INTO project_contract_audit_logs (contract_id, user_id, action, details)
        VALUES (?, ?, 'service_completed', '成果・役務の確認が行われ、支払条件が成立しました。')
      `).run(contractId, userId);

      const counterpartyId = userId === contract.organization_account_id ? contract.individual_account_id : contract.organization_account_id;
      db.prepare(`
        INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
        VALUES (?, ?, 'project_contract_service_completed', '成果物・役務の確認が完了し、支払条件が成立しました。', ?, 'project_contract')
      `).run(counterpartyId, userId, contractId);
      io.to(`user:${counterpartyId}`).emit('notification');

      const updated = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId);
      res.json(updated);
    } catch (e) {
      console.error('Error completing service:', e);
      res.status(500).json({ error: 'Failed to complete service' });
    }
  });

  // 9. Transfer Reward to Individual via Stripe Connect (個人85% / E-hub 15%) (項目34, 35, 40, 42)
  app.post('/api/project-contracts/:id/transfer-reward', async (req, res) => {
    try {
      const contractId = req.params.id;
      const userId = Number(req.headers['x-user-id'] || req.body.user_id);
      const contract = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId) as any;

      if (!contract) return res.status(404).json({ error: 'Contract not found' });
      if (contract.payment_status === 'transferred') {
        return res.status(400).json({ error: 'この報酬はすでに送金済みです。' });
      }

      const individualUser = db.prepare('SELECT stripe_account_id FROM users WHERE id = ?').get(contract.individual_account_id) as any;
      const stripe = getStripe();
      let transferId = 'mock_tr_' + Date.now();

      if (stripe && individualUser?.stripe_account_id && !individualUser.stripe_account_id.startsWith('mock_')) {
        try {
          const transfer = await stripe.transfers.create({
            amount: Math.round(contract.individual_net_amount || 0),
            currency: 'jpy',
            destination: individualUser.stripe_account_id,
            description: `E-hub 報酬支払 (Project Contract #${contractId})`
          });
          transferId = transfer.id;
        } catch (trErr: any) {
          console.error('Stripe transfer error:', trErr);
        }
      }

      db.prepare(`
        UPDATE project_contracts
        SET payment_status = 'transferred',
            contract_status = 'completed',
            stripe_transfer_id = ?,
            individual_payment_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transferId, contractId);

      // Audit log
      db.prepare(`
        INSERT INTO project_contract_audit_logs (contract_id, user_id, action, details)
        VALUES (?, ?, 'reward_transferred', '個人契約報酬（100%全額受取）の送金処理が完了しました。組織側E-hub成功報酬（5%）が確定しました。')
      `).run(contractId, userId);

      // Notifications
      const amountStr = (contract.individual_net_amount || 0).toLocaleString();
      db.prepare(`
        INSERT INTO notifications (user_id, from_user_id, type, message, item_id, item_type)
        VALUES (?, ?, 'project_contract_transferred', '報酬額（¥${amountStr}）の送金が完了しました。ご利用ありがとうございました！', ?, 'project_contract')
      `).run(contract.individual_account_id, contract.organization_account_id, contractId);
      io.to(`user:${contract.individual_account_id}`).emit('notification');

      const updated = db.prepare('SELECT * FROM project_contracts WHERE id = ?').get(contractId);
      res.json({ success: true, contract: updated });
    } catch (e) {
      console.error('Error transferring reward:', e);
      res.status(500).json({ error: 'Failed to transfer reward' });
    }
  });

  // 10. AI Assistant for Project Contract (項目71, 72: 長文回答を避け、不足情報の検出と1行質問を行う)
  app.post('/api/project-contracts/ai-suggest', async (req, res) => {
    try {
      const { project_title, idea_title, description, selected_type, current_form } = req.body;

      // Rule-based + smart AI suggestions
      let recommendedType: 'participation' | 'completion' | 'joint_business' = 'participation';
      let reason = '一定期間プロジェクトに参加して推進するスタイルに適しています。';
      let missingQuestion = '';
      let missingField = '';

      const text = `${project_title || ''} ${idea_title || ''} ${description || ''}`.toLowerCase();

      if (text.includes('成果物') || text.includes('納品') || text.includes('デザイン作成') || text.includes('lp制作') || text.includes('開発完了')) {
        recommendedType = 'completion';
        reason = '明確な成果物・納品物を定義して完成を目指すスタイルに適しています。';
      } else if (text.includes('共同') || text.includes('事業') || text.includes('レベニューシェア') || text.includes('売上分配') || text.includes('協業')) {
        recommendedType = 'joint_business';
        reason = '初期報酬や売上分配を組み合わせて共同で事業を育てるスタイルに適しています。';
      }

      // Check missing fields (項目71: 納期や報酬の未設定を検知して簡潔に質問)
      if (current_form) {
        if (!current_form.duration && !current_form.delivery_date) {
          missingField = 'duration';
          missingQuestion = '納期または想定期間が未設定です。いつまでに完成（またはどのくらいの期間参加）しますか？';
        } else if (!current_form.gross_amount && (!current_form.compensation_types || current_form.compensation_types.includes('fixed'))) {
          missingField = 'gross_amount';
          missingQuestion = '報酬金額が未入力です。想定する契約総額を入力してください。';
        } else if (current_form.project_contract_type === 'completion' && !current_form.deliverables) {
          missingField = 'deliverables';
          missingQuestion = '具体的な成果物（納品対象）が未記入です。何を作成・提出しますか？';
        } else if (current_form.project_contract_type === 'joint_business' && !current_form.revenue_share_rate && current_form.compensation_types?.includes('revenue_share')) {
          missingField = 'revenue_share_rate';
          missingQuestion = '売上分配率（%）が未設定です。何％を分配対象としますか？';
        }
      }

      res.json({
        recommended_type: recommendedType,
        recommendation_reason: reason,
        missing_field: missingField,
        missing_question: missingQuestion
      });
    } catch (e) {
      console.error('Error in AI contract suggest:', e);
      res.status(500).json({ error: 'Failed to generate suggestion' });
    }
  });


app.post('/api/scout_messages', (req, res) => {
    try {
      const { targetUserIds, message, targetItemType, targetItemId, targetItemTitle } = req.body;
      const senderId = req.headers['x-user-id'] || req.body.senderId; // Assuming you have a way to get senderId

      if (!targetUserIds || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const insertNotif = db.prepare('INSERT INTO notifications (user_id, sender_id, type, message, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)');
      
      db.transaction(() => {
        for (const userId of targetUserIds) {
          let notifMsg = message;
          let notifType = 'scout_message';
          if (targetItemTitle) {
            notifMsg = `${targetItemTitle}についてスカウト: ${message}`;
          }
          
          insertNotif.run(userId, senderId || null, notifType, notifMsg, targetItemId || null, targetItemType || null);
        }
      })();

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/scout_chat', async (req, res) => {
    try {
      const { prompt, messages: history, language, userId } = req.body;
      
      const systemPrompt = language === 'ja' 
        ? "あなたはE-hubというプラットフォームで、組織が優秀な人材（EMA）やアイデアを探すのを支援するAIスカウトです。ユーザーからの要望に基づき、どのようなスキルを持つ人材が適しているか提案したり、アドバイスを行ってください。フレンドリーかつプロフェッショナルなトーンで返答してください。"
        : "You are an AI Scout on the E-hub platform, assisting organizations in finding top talent (EMA) and ideas. Based on the user's requirements, suggest what kind of skills they should look for, or provide advice. Respond in a friendly and professional tone.";

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...(history || [{ role: 'user', content: prompt || '' }])
      ];

      let text = '';
      try {
        const response = { text: await generateText([...(history || []), { role: 'user', content: prompt || '' }], systemPrompt) };
        text = response.text || '';
      } catch (openaiError) {
        console.warn('OpenAI API failed in scout_chat, falling back to OpenAI:', openaiError);
        // Fallback to text.OpenAI.ai
        let OpenAISuccess = false;
        try {
          const apiRes = await requestAIText({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: apiMessages
            })
          });
          if (apiRes.ok) {
            text = await apiRes.text();
            OpenAISuccess = true;
          } else {
             console.warn('OpenAI API failed:', apiRes.status);
          }
        } catch (err) {
           console.warn('OpenAI API error:', err);
        }

        if (!OpenAISuccess) {
          text = language === 'ja' 
            ? '申し訳ありません。現在AIスカウトの応答生成システムが混み合っています。いくつかのおすすめプロフィールを見つけましたので、こちらをご検討ください。'
            : 'I apologize, but my response generation system is currently busy. However, I found some relevant profiles for you to consider below.';
        }
      }

      // Extract potential keywords from the prompt (simple split)
      const keywords = (prompt || '').split(/[\s,。、]+/).filter((k: string) => k.length > 1);
      
      let profiles: any[] = [];
      const excludeCondition = userId ? `AND id != ?` : '';
      const baseParams = userId ? [userId] : [];

      if (keywords.length > 0) {
        // Try to match keywords in username, title, or tags
        const likeConditions = keywords.map(() => `(username LIKE ? OR title LIKE ? OR tags LIKE ?)`).join(' OR ');
        const params = [...baseParams, ...keywords.flatMap((k: string) => [`%${k}%`, `%${k}%`, `%${k}%`])];
        
        profiles = db.prepare(`
          SELECT id, username, avatar, title, account_type, tags 
          FROM users 
          WHERE (account_type = 'ema' OR account_type = 'individual' OR account_type = 'organization')
            ${excludeCondition}
            AND (${likeConditions})
          ORDER BY CASE WHEN account_type = 'ema' THEN 0 ELSE 1 END, RANDOM() 
          LIMIT 5
        `).all(...params);
      }

      // Fallback if no matching profiles
      if (profiles.length === 0) {
        profiles = db.prepare(`
          SELECT id, username, avatar, title, account_type, tags 
          FROM users 
          WHERE (account_type = 'ema' OR account_type = 'individual' OR account_type = 'organization')
            ${excludeCondition}
          ORDER BY CASE WHEN account_type = 'ema' THEN 0 ELSE 1 END, RANDOM() 
          LIMIT 5
        `).all(...baseParams);
      }

      console.log('Sending profiles:', JSON.stringify(profiles));
      res.json({ text, profiles });
    } catch (e: any) {
      console.warn('Error in scout_chat:', e);
      res.status(500).json({ error: 'Failed to generate response' });
    }
  });

  app.get('/api/users/:userId/scout_sessions', (req, res) => {
    try {
      const sessions = db.prepare('SELECT * FROM scout_sessions WHERE user_id = ? ORDER BY created_at DESC').all(req.params.userId);
      res.json(sessions);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch scout sessions' });
    }
  });

  app.get('/api/scout_sessions/:sessionId/messages', (req, res) => {
    try {
      const messages = db.prepare('SELECT * FROM scout_messages WHERE session_id = ? ORDER BY id ASC').all(req.params.sessionId);
      res.json(messages.map((m: any) => ({
        ...m,
        profiles: m.profiles ? JSON.parse(m.profiles) : undefined
      })));
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch scout messages' });
    }
  });

  app.post('/api/scout_sessions', (req, res) => {
    try {
      const { user_id, title } = req.body;
      const result = db.prepare('INSERT INTO scout_sessions (user_id, title) VALUES (?, ?)').run(user_id, title || 'New Chat');
      const session = db.prepare('SELECT * FROM scout_sessions WHERE id = ?').get(result.lastInsertRowid);
      res.json(session);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create scout session' });
    }
  });

  app.post('/api/scout_sessions/:sessionId/messages', (req, res) => {
    try {
      const { role, content, profiles } = req.body;
      const profilesStr = profiles ? JSON.stringify(profiles) : null;
      const result = db.prepare('INSERT INTO scout_messages (session_id, role, content, profiles) VALUES (?, ?, ?, ?)').run(req.params.sessionId, role, content, profilesStr);
      res.json({ id: result.lastInsertRowid, session_id: req.params.sessionId, role, content, profiles });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to insert scout message' });
    }
  });

  app.patch('/api/scout_sessions/:sessionId/title', (req, res) => {
    try {
      db.prepare('UPDATE scout_sessions SET title = ? WHERE id = ?').run(req.body.title, req.params.sessionId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update scout session title' });
    }
  });

  app.delete('/api/scout_sessions/:sessionId', (req, res) => {
    try {
      db.prepare('DELETE FROM scout_sessions WHERE id = ?').run(req.params.sessionId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete scout session' });
    }
  });

  app.post('/api/ideas/summarize', async (req, res) => {
    try {
      const { text } = req.body;
      const systemContent = "以下のアイデア群の内容を整理し、論理的なひとつのまとめ記事としてHTML形式に要約・構築してください。HTMLのタグ（h2, h3, p, ul, li, strongなど）を使用してきれいに整形し、見やすくまとめてください。```html や ``` のようなマークダウンのコードブロックは含めず、純粋なHTMLだけを返してください。";
      
      const apiRes = await requestAIText({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: text }
          ]
        })
      });
      
      if (!apiRes.ok) throw new Error('OpenAI API failed');
      const apiText = await apiRes.text();
      res.json({ result: apiText.replace(/```html|```/g, '') });
    } catch (e) {
      console.error('Error summarizing ideas:', e);
      res.status(500).json({ error: 'Failed to summarize ideas' });
    }
  });

    app.post('/api/generate_image', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
      
      const base64Data = await generateImage(prompt);
      res.json({ image: `data:image/png;base64,${base64Data}` });
    } catch (e: any) {
      console.error('Error generating image:', e);
      const errorMessage = e.message || 'Failed to generate image';
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/ai/analyze-thought', async (req, res) => {
    const { thought, files, account_type } = req.body;
    const isOrgAccount = account_type === 'organization';

    if ((!thought || typeof thought !== 'string' || !thought.trim()) && (!files || !Array.isArray(files) || files.length === 0)) {
      return res.status(400).json({ error: 'Thought or attached files required' });
    }

    const trimmedThought = (thought || '').trim();

    let fileContext = '';
    if (Array.isArray(files) && files.length > 0) {
      fileContext = '\n\n【添付ファイル資料データ】:\n' + files.map((f: any) => `ファイル名: ${f.name} (${f.type || ''})\n内容概要:\n${f.extractedText || f.content || ''}`).join('\n\n');
    }

    const fullInputText = `${trimmedThought}${fileContext}`;

    // Search SQLite for actual similar existing Visions
    let similarVisions: any[] = [];
    try {
      const keywords = trimmedThought.split(/\s+/).filter(k => k.length > 1);
      if (keywords.length > 0) {
        const firstKw = keywords[0];
        const rows = db.prepare(`
          SELECT id, title, description, image, author_name, created_at 
          FROM projects 
          WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?
          LIMIT 3
        `).all(`%${firstKw}%`, `%${firstKw}%`, `%${firstKw}%`) as any[];
        similarVisions = rows || [];
      }
      if (similarVisions.length === 0) {
        const rows = db.prepare(`
          SELECT id, title, description, image, author_name, created_at 
          FROM projects 
          ORDER BY id DESC LIMIT 3
        `).all() as any[];
        similarVisions = rows || [];
      }
    } catch (e) {
      similarVisions = [];
    }

    const systemPrompt = `You are an AI Vision Design Assistant for a platform called eHub.
Analyze the user's input and attached materials:
"${fullInputText}".

Input materials may include text notes, bullet points, and attached documents (Word, Excel, PDF, PPT, CSV, Images with charts/tables).
If Excel files are attached, pay special attention to sheet names, table headers, and key numbers.
If PDF/Word/PPT/Images are attached, consider table data, diagram structures, and chart contents alongside text.

CRITICAL DIRECTIVE:
Do NOT change the user's original intent. Maintain their original core thoughts and goals while correcting, complementing, and structuring them into a complete, high-impact "Vision" and analytical breakdown.

AI VISION CREATION FUNCTION SCOPE:
AI Vision作成機能は、ユーザーが入力した文章、箇条書き、メモ、添付資料などを読み取り、内容を補正・補完・構造化して、Visionの下書きを作成する機能です。
主な役割は次の通りです:
- ユーザーの考えを整理する
- 誤字・脱字・重複表現を補正する
- 不足情報を質問する
- 添付資料から関連情報を抽出する
- Vision投稿に適した構成へまとめる
- ユーザーの確認後にVisionとして投稿する

STRICT RULE FOR POST TARGET:
AIはRecruitmentまたはOfferの投稿先判定を行わないでください。作成される投稿の種類は「Vision」のみに固定してください。
"suggested_post_target"の"recommended_target"は常に "Vision" とし、"available_candidates" は ["Vision"] のみとしてください。
複数の投稿への分割（split_suggestions）提案も行わないでください（is_multi_element_detected: false）。

IMPORTANT RULE FOR VISION ITEMS:
Do NOT force fill every field if information is missing or unclear! If sufficient information cannot be deduced from the input/documents, do NOT make up facts. Set that specific field to "情報が不足しています". Also include specific follow-up questions in "user_questions" to help the user complete missing parts.

Return ONLY a raw JSON object (without markdown wrapping) matching this schema:
{
  "theme": "Category/Theme name (e.g., 地域活性化・新産業創出)",
  "vision": {
    "title": "Clear, inspiring Vision Title preserving user intent",
    "background": "Concise background explanation incorporating user points and attached materials",
    "purpose": "Core purpose statement preserving user intent",
    "social_issues": "Current social/environmental issues to address (現状の課題)",
    "expected_effects": "Expected social and environmental impact"
  },
  "generated_vision_items": {
    "title": "Visionタイトル（ユーザーの意図を汲んだ象徴的タイトル）",
    "summary": "概要（全体の要約）",
    "desired_future": "実現したい未来（目指す世界観）",
    "current_issues": "現状の課題（直面している問題・リソースや技術の不足など）",
    "background": "背景（課題が生じた要因や社会的背景）",
    "target_scope": "対象者（ターゲットとなる人・地域・組織）",
    "purpose": "目的（なぜ行うのかの本質）",
    "solution_direction": "解決の方向性（取り組むアプローチ）",
    "needed_cooperation": "必要だと考えている協力（共創パートナー・企業・人材に期待する支援や協力内容）",
    "intended_stakeholders": "想定している関係者（巻き込みたい自治体・企業・地域住民など）",
    "required_elements": "実現に必要な要素（必要となる技術・設備・仕組み・契約・制度など）",
    "future_expansion": "将来的な展開（Visionが実現した先の広がりや事業展開・社会的影響）",
    "expected_effects": "期待される効果（定性的・定量的影響）",
    "evidence_and_data": "関連するデータ・根拠（資料中の数値や実績データ）",
    "recruiting_ideas_direction": "募集したいIdeaの方向性（共創者に期待する提案テーマ）",
    "category": "カテゴリ（分野分類）",
    "tags": ["関連タグ1", "関連タグ2", "関連タグ3"]
  },
  "user_questions": [
    "1番目に重要な問いかけ（例: このVisionで最も支援したい対象は誰ですか？）",
    "2番目に重要な問いかけ（例: 対象地域は特定されていますか？）",
    "3番目に重要な問いかけ（例: 実現時期や規模の目安はありますか？）"
  ],
  "analysis_details": {
    "desired_goal": "ユーザーが本質的に実現したいこと・目指すゴール",
    "current_issues": "直面している現状の具体的な課題",
    "issue_background": "課題が生じている社会的・組織的背景",
    "target_scope": "対象となる具体的な人・地域・組織・ターゲット",
    "solution_direction": "課題解決に向けた具体的なアプローチ・方向性",
    "expected_state": "実現後に期待される理想の状態・波及効果",
    "evidence_and_data": "資料や入力に含まれる数値データ・根拠・図表やExcelシートの主要データ",
    "missing_info": "Vision実現に向けて現在不足している情報・今後補強すべき点",
    "contradictions_or_unclear": "入力・資料内で見られる矛盾点・論理的飛躍・要確認・不明確な点"
  },
  "processing_steps": {
    "correction": {
      "corrected_text": "誤字・脱字・重複・読みづらさを修正した文章（ユーザーの意図・主張は維持）",
      "correction_notes": "修正点の説明（例: 誤字の修正、文節の整理、重複表現の簡略化など）"
    },
    "completion": {
      "ai_completion_proposals": [
        "AIによる補完案1: 入力から推測される不足情報・拡張アイデア（※ユーザー確認用の仮提案）",
        "AIによる補完案2: 推測される具体的な数値目標や実施スキーム案"
      ],
      "completion_note": "※上記は入力内容からAIが推測した補完案です。ユーザーの同意なしに確定情報としては扱いません。"
    },
    "structuring": {
      "structured_vision_summary": "Vision投稿に適した構成（背景・目的・課題・期待効果）への整理サマリー"
    }
  },
  "suggested_ideas": [
    "Idea Candidate 1",
    "Idea Candidate 2",
    "Idea Candidate 3",
    "Idea Candidate 4",
    "Idea Candidate 5"
  ],
  "suggested_post_target": {
    "recommended_target": "Vision",
    "reason": "ユーザーの入力内容・希望（募集や提案要素を含む）を未来の構想として整理し、Vision投稿用フォーマットに構造化しました。",
    "available_candidates": ["Vision"]
  },
  "split_suggestions": {
    "is_multi_element_detected": false,
    "elements": []
  }
}

CRITICAL RULE FOR RECRUITMENT / OFFER EXPRESSIONS IN INPUT (REQUIREMENT 4):
Even if the user's input text or attached documents contain expressions related to recruitment, sourcing, or proposals, such as:
- 協力者を探したい (Wanting to find collaborators)
- Ideaを募集したい (Wanting to solicit ideas)
- 組織に提案したい (Wanting to propose to an organization)
- 企業と共同開発したい (Wanting joint development with enterprise)
- 特定の企業に送信したい (Wanting to send to specific enterprise)
- 人材を集めたい (Wanting to gather talent/people)
- 技術を持つ組織を探したい (Wanting to find organization with specific tech)
- 契約につなげたい (Wanting to lead to a contract/business deal)

DO NOT suggest Recruitment or Offer under any circumstances! DO NOT output statements like "この内容はRecruitmentに適しています" or "Offerとして送信しますか".
Instead, seamlessly incorporate all these recruitment/proposal goals into the Vision structure as part of the future goals, current issues, needed cooperation, intended stakeholders, required elements, and future expansion.

STRUCTURING RULES FOR VISION ITEMS:
Organize the recruitment/proposal elements into Vision components:
- 実現したい未来 (desired_future): The vision of the future the user wants to achieve.
- 現状の課題 (current_issues): Current difficulties, bottlenecks, or resource gaps.
- 必要だと考えている協力 (needed_cooperation / solution_direction): Cooperation or partnerships desired to realize the vision.
- 想定している関係者 (target_scope / intended_stakeholders): Stakeholders, organizations, or collaborators expected to be involved.
- 実現に必要な要素 (required_elements / evidence_and_data): Essential capabilities, technologies, or assets required.
- 将来的な展開 (future_expansion / expected_effects): Long-term expansion and positive impact.

Post target MUST ALWAYS be "Vision".
"suggested_post_target" must always have "recommended_target": "Vision" and "available_candidates": ["Vision"].
"split_suggestions" must always have "is_multi_element_detected": false and "elements": [].`;

    try {
      let responseText = '';
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = { text: await generateText(systemPrompt) };
          responseText = response.text || '';
        } catch (openaiErr: any) {
          console.log('[AI Engine] Primary model unavailable or quota depleted. Switching to fallback AI engine...');
        }
      }

      if (!responseText) {
        // Fallback to OpenAI API with 5s timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const apiRes = await requestAIText({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: systemPrompt }]
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (apiRes.ok) {
            responseText = await apiRes.text();
          }
        } catch (pollErr) {
          // Proceed to instant local heuristics
        }
      }

      let parsed: any = null;
      if (responseText) {
        let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          parsed = JSON.parse(cleanJson);
        } catch (e) {
          console.warn("Failed to parse JSON from AI response, using smart fallback");
        }
      }

      if (!parsed) {
        // High quality fallback
        parsed = {
          theme: trimmedThought.slice(0, 20),
          vision: {
            title: `${trimmedThought || '事業構想'}による持続可能な地域社会の実現`,
            background: `${trimmedThought || '添付資料'}を取り巻く現状の課題意識と社会課題ニーズに対応`,
            purpose: `テクノロジーとオープンイノベーションの力で${trimmedThought || '事業構想'}を実現する`,
            social_issues: `急速な環境変化と既存インフラの老朽化・対応遅れ`,
            expected_effects: `生活環境の快適化・エネルギー効率の向上・新規産業創出`
          },
          generated_vision_items: {
            title: `${trimmedThought || '事業構想'}による持続可能な地域社会の実現`,
            summary: `${trimmedThought || '入力文章・資料'}に基づき、地域社会課題解決と価値創出に向けた事業構想をモデル化しました。`,
            desired_future: `市民・企業・行政が連携し、テクノロジーの活用で快適かつ持続可能な環境が定着している未来`,
            current_issues: `既存インフラの対応遅れ、専門人材不足、現場データの有効活用不足`,
            background: `環境変化の加速とユーザーニーズ多様化に伴い、従来の枠組みでは対応が困難になっている点`,
            target_scope: `地域住民、地方自治体、関連共創企業、実証コミュニティ`,
            purpose: `持続可能な基盤整備とオープンイノベーションによる新規価値創出`,
            solution_direction: `デジタル技術と実証実験を組み合わせた段階的サービス導入`,
            expected_effects: `QoL（生活の質）向上、地域経済の活性化、運用コストの30%削減`,
            evidence_and_data: `添付資料・表データにおける現状数値指標および構造化テキスト`,
            recruiting_ideas_direction: `実証実験アイデア、現場導入技術、地域連携施策、UXデザイン提案`,
            category: `地域活性化・まちづくり`,
            tags: [`オープンイノベーション`, `スマートシティ`, `地域共創`]
          },
          user_questions: [
            "初期実証実験を実施する対象地域の規模や人口ターゲットについて補足情報はありますか？",
            "本構想で想定している初年度の予算規模や主な資金調達手段についてお教えください。"
          ],
          analysis_details: {
            desired_goal: `${trimmedThought || '事業構想'}を具現化し、持続可能な社会基盤を構築すること`,
            current_issues: `既存仕組みの対応遅れ、リソース・データの分散、関係者間の情報共有不足`,
            issue_background: `環境変化の加速とユーザーニーズ多様化に対する迅速な検証プロセスの不足`,
            target_scope: `地域住民・関係自治体・企業パートナー・共創コミュニティ`,
            solution_direction: `オープンイノベーション手法とデジタル技術の導入によるプロセス最適化`,
            expected_state: `共創を通じた価値創出・生産性向上および生活品質（QoL）の向上`,
            evidence_and_data: `添付資料・表データにおける現状数値指標および構造化テキスト`,
            missing_info: `具体的な予算規模、実行スケジュール、初期実証テスト地域の選定`,
            contradictions_or_unclear: `短期的な導入費用と中長期的な期待費用対効果のバランス精査が必要`
          },
          processing_steps: {
            correction: {
              corrected_text: `${trimmedThought || '入力文章'}の誤字脱字・文脈表現をブラッシュアップしました（※ユーザーの主張や意図は保持されています）。`,
              correction_notes: "文章表現の整理、専門用語の表記揺れ統一、重複句の削除"
            },
            completion: {
              ai_completion_proposals: [
                "【AIによる補完案】対象地域における自治体および地域企業との連携実証モデル構築",
                "【AIによる補完案】定量的な成果指標（KPI: 参加者数・コスト削減率など）の設定"
              ],
              completion_note: "※上記は入力内容からAIが推測した補足案です。確定情報ではなく、ご確認の上で活用してください。"
            },
            structuring: {
              structured_vision_summary: "背景・課題・目的・期待効果の4セクションに整理し、Vision投稿用フォーマットへ構造化を完了しました。"
            }
          },
          suggested_ideas: [
            'IoTセンサーによるリアルタイム状況可視化',
            'コミュニティ参加型プラットフォーム',
            '環境負荷の低い新素材導入',
            '地域連携による実証実験枠組み',
            'データ分析型AI最適化エンジン'
          ],
          suggested_post_target: {
            recommended_target: 'Vision',
            reason: '入力内容を補正・補完・構造化し、Visionの下書きとして整理しました。',
            available_candidates: ['Vision']
          },
          split_suggestions: {
            is_multi_element_detected: false,
            elements: []
          }
        };
      }

      // 投稿先はVisionに固定
      if (parsed.suggested_post_target) {
        parsed.suggested_post_target.recommended_target = 'Vision';
        parsed.suggested_post_target.reason = '入力内容を補正・補完・構造化し、Visionの下書きとして整理しました。';
        parsed.suggested_post_target.available_candidates = ['Vision'];
        delete parsed.suggested_post_target.target_clarification;
      }
      parsed.split_suggestions = {
        is_multi_element_detected: false,
        elements: []
      };

      return res.json({
        ...parsed,
        similarVisions
      });

    } catch (err: any) {
      console.error("analyze-thought error:", err);
      res.status(500).json({ error: 'Failed to analyze thought' });
    }
  });

  // AI Vision Workspace Conversational Chat Endpoint (Specification 7, 8, 9, 10, 16, 17, 18, 19, 34)
  app.post('/api/ai/vision-workspace-chat', async (req, res) => {
    try {
      const {
        messages = [],
        currentVision = {},
        newInstruction = '',
        attachedFiles = [],
        addedFile = null
      } = req.body;

      if (!newInstruction && !addedFile && messages.length === 0) {
        return res.status(400).json({ error: 'Instruction or context required' });
      }

      let fileContext = '';
      if (Array.isArray(attachedFiles) && attachedFiles.length > 0) {
        fileContext = '\n【添付資料データ】:\n' + attachedFiles.map((f: any) => `ファイル名: ${f.name}\n抽出内容:\n${f.extractedText || f.content || ''}`).join('\n\n');
      }
      if (addedFile) {
        fileContext += `\n\n【新規追加された添付ファイル】:\nファイル名: ${addedFile.name}\n抽出内容:\n${addedFile.extractedText || addedFile.content || ''}`;
      }

      const systemPrompt = `You are the AI Vision Assistant for E-hub.
You are co-creating a "Vision" with the user in an interactive chat workspace.
The right side of the screen displays the actual live Vision post content, which you can update based on user conversation.

Current Live Vision Data:
${JSON.stringify(currentVision, null, 2)}
${fileContext}

Conversation History:
${messages.map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}

Latest User Message / Action:
"${newInstruction || (addedFile ? `【資料「${addedFile.name}」を追加しました】` : '')}"

CRITICAL RULES (Strictly enforce specifications 7, 8, 9, 10, 16, 17, 18, 19, 34):
1. **SELECTIVE MODIFICATION (Req 16)**:
   - ONLY modify the fields that are directly relevant to the user's instructions or answers!
   - Do NOT rewrite or regenerate the entire Vision unless explicitly asked (e.g. "全体をイチから作り直して").
   - If user says "タイトルをもっと短くして", change ONLY the "title" field. Leave all other fields unchanged.
2. **MULTI-FIELD IMPACT NOTIFICATION (Req 17)**:
   - If the user's instruction substantially impacts multiple fields (e.g., changing the target audience pivots target_scope, purpose, and solution_direction), state concisely in the reply: "この変更は「目的」「対象」「実現の方向性」の3項目に影響します。反映しました。"
3. **NATURAL QUESTIONING & REFINEMENT (Req 8)**:
   - If information is missing or could make the Vision more compelling, ask ONE natural, focused follow-up question (e.g. "この取り組みは、主に誰を対象としていますか？"). Do not overwhelm the user with lists of questions.
4. **FILE HANDLING (Req 19)**:
   - If a new file was attached, do NOT arbitrarily overwrite everything. Politely acknowledge the file, summarize its key insights, and ask or inform the user how it can be applied to specific sections.
5. **FACT & AI COMPLETION HONESTY (Req 18)**:
   - Never invent false statistics, fake citations, or unfounded claims. Preserve user facts and clearly demarcate user facts vs logical structuring.
6. **POST TARGET IS ALWAYS VISION (Req 26, 34)**:
   - Never suggest Recruitment, Offer, Project, or Proposal. Only Vision.

Output MUST be a valid, raw JSON object (no markdown \`\`\`json wrappers) matching this schema:
{
  "replyMessage": "AI's friendly, conversational reply in Japanese. If fields were modified, explain what changed concisely. If follow-up is needed, ask the single next natural question.",
  "modifiedFields": ["title", "target_scope"], // Array of exact keys in updatedVision that were modified in this turn
  "modifiedSummary": "簡潔な変更サマリー（例: タイトルの短縮と対象範囲の更新）",
  "updatedVision": {
    "title": "Visionタイトル",
    "summary": "概要",
    "desired_future": "実現したい未来",
    "current_issues": "現状の課題",
    "background": "背景",
    "target_scope": "対象",
    "purpose": "目的",
    "solution_direction": "実現の方向性",
    "needed_cooperation": "必要だと考えている協力",
    "intended_stakeholders": "想定している関係者",
    "expected_effects": "期待される効果",
    "evidence_and_data": "関連するデータ・根拠",
    "recruiting_ideas_direction": "募集したいIdeaの方向性",
    "category": "カテゴリ",
    "tags": ["タグ1", "タグ2"]
  },
  "provenanceMap": {
    "title": "user" | "ai" | "file",
    "summary": "user" | "ai" | "file",
    "desired_future": "user" | "ai" | "file",
    "current_issues": "user" | "ai" | "file",
    "background": "user" | "ai" | "file",
    "target_scope": "user" | "ai" | "file",
    "purpose": "user" | "ai" | "file",
    "solution_direction": "user" | "ai" | "file",
    "needed_cooperation": "user" | "ai" | "file",
    "intended_stakeholders": "user" | "ai" | "file",
    "expected_effects": "user" | "ai" | "file",
    "evidence_and_data": "user" | "ai" | "file",
    "recruiting_ideas_direction": "user" | "ai" | "file",
    "category": "user" | "ai" | "file",
    "tags": "user" | "ai" | "file"
  },
  "suggestedQuestions": ["次に深掘りできる質問候補1"]
}`;

      let responseText = '';
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = { text: await generateText(systemPrompt) };
          responseText = response.text || '';
        } catch (openaiErr: any) {
          // Gracefully fallback when rate limited or quota depleted (e.g. 429 RESOURCE_EXHAUSTED)
          console.log('[AI Vision Chat] OpenAI quota or network notice, utilizing smart AI fallback engine.');
        }
      }

      if (!responseText) {
        try {
          const apiRes = await requestAIText({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: systemPrompt }]
            })
          });
          if (apiRes.ok) {
            responseText = await apiRes.text();
          }
        } catch (pollErr) {
          // Silently fall back to heuristic generator
        }
      }

      let parsed: any = null;
      if (responseText) {
        let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          parsed = JSON.parse(cleanJson);
        } catch (e) {
          // Parse fallback
        }
      }

      if (!parsed || !parsed.updatedVision) {
        // High-intelligence Local Fallback Engine (Specification 7, 8, 9, 10, 16, 17, 18, 34)
        const text = newInstruction.toLowerCase();
        const isShortenTitle = /短|短縮|わかりやす|分かりやす|タイト/.test(text);
        const isTarget = /対象|誰|ターゲット|高齢者|住民|市民|若者|子供|学生|企業|自治体/.test(text);
        const isPurpose = /目的|なぜ|理由|ビジョン|何のため/.test(text);
        const isIssue = /課題|問題|現状|困難|ボトルネック/.test(text);
        const isFuture = /未来|目指す|理想|実現したい/.test(text);
        const isBackground = /背景|経緯|理由|きっかけ/.test(text);
        const isDirection = /方向性|アプローチ|手法|解決策|施策|ステップ/.test(text);
        const isCooperation = /協力|パートナー|支援|協業|募集|求める/.test(text);
        const isEffects = /効果|インパクト|メリット|成果|成果指標/.test(text);
        const isEvidence = /データ|根拠|数値|統計|根拠/.test(text);
        const isFileReflect = /資料|ファイル|pdf|excel|反映|内容/.test(text) && attachedFiles.length > 0;

        const updated = { ...currentVision };
        const modified: string[] = [];
        const prov = { ...(currentVision.provenanceMap || {}) };

        const cleanVal = newInstruction
          .replace(/^(もう少し|もっと|について|の項目を|対象を|目的を|課題を|タイトルを|背景を|未来を|方向性を|協力を|効果を|データを)?/g, '')
          .replace(/(に変更して|にして|に変えて|に修正して|として反映して|に設定して|としてください|してください|して|お願い)$/g, '')
          .trim();

        if (isShortenTitle && updated.title) {
          updated.title = cleanVal && cleanVal.length > 3 && cleanVal.length < 35 
            ? cleanVal 
            : (updated.title.split('における')[0] || updated.title.split('による')[0] || updated.title.slice(0, 22));
          modified.push('title');
          prov.title = 'user';
        }
        
        if (isTarget) {
          updated.target_scope = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('target_scope');
          prov.target_scope = 'user';
        }
        
        if (isPurpose) {
          updated.purpose = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('purpose');
          prov.purpose = 'user';
        }
        
        if (isIssue) {
          updated.current_issues = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('current_issues');
          prov.current_issues = 'user';
        }

        if (isFuture) {
          updated.desired_future = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('desired_future');
          prov.desired_future = 'user';
        }

        if (isBackground) {
          updated.background = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('background');
          prov.background = 'user';
        }

        if (isDirection) {
          updated.solution_direction = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('solution_direction');
          prov.solution_direction = 'user';
        }

        if (isCooperation) {
          updated.needed_cooperation = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('needed_cooperation');
          prov.needed_cooperation = 'user';
        }

        if (isEffects) {
          updated.expected_effects = cleanVal.length > 1 ? cleanVal : newInstruction;
          modified.push('expected_effects');
          prov.expected_effects = 'user';
        }

        if (isEvidence || isFileReflect) {
          const fileEvidence = attachedFiles.map((f: any) => `${f.name}の抽出数値・分析データ`).join(', ');
          updated.evidence_and_data = fileEvidence || cleanVal || '現状の定量ヒアリングデータおよび市場推計';
          modified.push('evidence_and_data');
          prov.evidence_and_data = 'file';
        }

        if (modified.length === 0) {
          modified.push('summary');
          updated.summary = (updated.summary || '') + `\n（反映内容: ${newInstruction}）`;
          prov.summary = 'user';
        }

        const fieldLabels: Record<string, string> = {
          title: 'Visionタイトル',
          summary: '概要',
          desired_future: '実現したい未来',
          current_issues: '現状の課題',
          background: '背景',
          target_scope: '対象',
          purpose: '目的',
          solution_direction: '実現の方向性',
          needed_cooperation: '必要だと考えている協力',
          intended_stakeholders: '想定している関係者',
          expected_effects: '期待される効果',
          evidence_and_data: '関連するデータ・根拠',
          recruiting_ideas_direction: '募集したいIdeaの方向性'
        };

        const changedNames = modified.map(m => fieldLabels[m] || m);

        parsed = {
          replyMessage: modified.length > 1
            ? `この変更は「${changedNames.join('」「')}」の${modified.length}項目に影響します。右側の投稿内容へ反映しました。\n\n続いて、さらに具体化したい箇所や修正したい部分はありますか？`
            : `ありがとうございます。「${changedNames[0]}」として右側の投稿内容へ反映しました。\n\n💡 **次のご質問**: このVisionを実現する上で、特にどのような専門性やパートナーからの協力を求めたいですか？`,
          modifiedFields: modified,
          modifiedSummary: `${changedNames.join(', ')}の更新`,
          updatedVision: updated,
          provenanceMap: prov,
          suggestedQuestions: [
            '自治体や地元企業との協業を募集したい',
            'テクノロジー開発ができるエンジニアを募集したい',
            'タイトルをもっとシンプルにして',
            '現状の課題をもっと具体的にして'
          ]
        };
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("vision-workspace-chat error:", err);
      res.status(500).json({ error: 'Failed to process vision workspace chat' });
    }
  });

  app.post('/api/translate', async (req, res) => {
    const { text, target_language } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OpenAI API key is not configured' });
    }

    try {
      let translation = '';
      const prompt = `Translate the following HTML content to ${target_language}. Preserve all HTML tags and structure, only translate the text inside the tags. Return only the translated HTML without any markdown formatting or extra comments:

${text}`;
      try {
        const response = { text: await generateText(prompt) };
        translation = response.text || '';
      } catch (openaiError: any) {
        console.log('[AI Engine] Primary model unavailable for translate, switching to fallback...');
        const apiRes = await requestAIText({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }]
          })
        });
        if (apiRes.ok) {
          translation = await apiRes.text();
        } else {
          throw new Error('Both OpenAI and OpenAI failed');
        }
      }
      if (translation.startsWith('```html')) {
          translation = translation.replace(/^```html\\n/, '').replace(/\\n```$/, '');
      } else if (translation.startsWith('```')) {
          translation = translation.replace(/^```(?:\\w+)?\\n/, '').replace(/\\n```$/, '');
      }
      res.json({ translation });
    } catch (err) {
      console.error('Translation error:', err);
      res.status(500).json({ error: 'Failed to translate' });
    }
  });

// --- Rating APIs ---
app.get('/api/items/:type/:id/rateable_users', (req, res) => {
  const { type, id } = req.params;
  const current_user_id = req.query.current_user_id;
  if (!current_user_id) return res.status(401).json({ error: 'Unauthorized' });

  let item;
  if (type === 'idea') {
    item = db.prepare('SELECT author_id FROM ideas WHERE id = ?').get(id) as any;
  } else {
    item = db.prepare('SELECT author_id FROM projects WHERE id = ?').get(id) as any;
  }
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const author_id = item.author_id;

  if (Number(current_user_id) === Number(author_id)) {
    // Author wants to rate followers
    const followers = db.prepare(`
      SELECT u.id, u.username, u.avatar, u.title
      FROM idea_follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.${type === 'idea' ? 'idea_id' : 'project_id'} = ? AND f.is_mutual = 1
      AND u.id NOT IN (SELECT to_user_id FROM ratings WHERE project_id = ? AND from_user_id = ?)
    `).all(id, id, author_id);
    return res.json({ role: 'author', usersToRate: followers });
  } else {
    // Check if current user is a mutual follower
    const isMutual = db.prepare(`
      SELECT 1 FROM idea_follows WHERE ${type === 'idea' ? 'idea_id' : 'project_id'} = ? AND follower_id = ? AND is_mutual = 1
    `).get(id, current_user_id);
    if (!isMutual) return res.json({ role: 'none', usersToRate: [] });

    // Follower wants to rate author
    const hasRated = db.prepare(`
      SELECT 1 FROM ratings WHERE project_id = ? AND from_user_id = ? AND to_user_id = ?
    `).get(id, current_user_id, author_id);
    
    if (hasRated) return res.json({ role: 'follower', usersToRate: [] });

    const author = db.prepare('SELECT id, username, avatar, title FROM users WHERE id = ?').get(author_id);
    return res.json({ role: 'follower', usersToRate: author ? [author] : [] });
  }
});

app.post('/api/items/:type/:id/ratings', (req, res) => {
  const { type, id } = req.params;
  const { from_user_id, ratings } = req.body; // ratings is array of { to_user_id, rating }

  const insert = db.prepare('INSERT OR IGNORE INTO ratings (project_id, from_user_id, to_user_id, rating) VALUES (?, ?, ?, ?)');
  
  db.transaction(() => {
    for (const r of ratings) {
      insert.run(id, from_user_id, r.to_user_id, r.rating);
    }
  })();

  res.json({ success: true });
});

// --- Buyout APIs ---
app.post('/api/buyouts', (req, res) => {
  const { item_type, item_id, creator_id, buyout_type, price, start_date, end_date } = req.body;
  if (!userExists(creator_id)) return res.status(400).json({ error: 'User not found' });

  try {
    const info = db.prepare('INSERT INTO buyouts (item_type, item_id, creator_id, buyout_type, price, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      item_type, item_id, creator_id, buyout_type, price, start_date || null, end_date || null
    );
    
    // Also update the item to indicate it's in buyout
    if (item_type === 'idea') {
      db.prepare('UPDATE ideas SET is_buyout = 1, buyout_price = ? WHERE id = ?').run(price, item_id);
      const followers = db.prepare('SELECT follower_id FROM idea_follows WHERE idea_id = ? AND is_mutual = 1').all(item_id) as any[];
      const notifyStmt = db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)');
      for (const f of followers) {
        notifyStmt.run(f.follower_id, 'rate_user', creator_id, item_id, 'idea');
        io.to(`user:${f.follower_id}`).emit('notification');
      }
    } else {
      db.prepare('UPDATE projects SET is_buyout = 1, buyout_price = ? WHERE id = ?').run(price, item_id);
      const followers = db.prepare('SELECT follower_id FROM idea_follows WHERE project_id = ? AND is_mutual = 1').all(item_id) as any[];
      const notifyStmt = db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)');
      for (const f of followers) {
        notifyStmt.run(f.follower_id, 'rate_user', creator_id, item_id, 'project');
        io.to(`user:${f.follower_id}`).emit('notification');
      }
    }

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    console.error('Error posting buyout:', e);
    res.status(500).json({ error: 'Failed to post buyout' });
  }
});

app.get('/api/buyouts', (req, res) => {
  const buyouts = db.prepare(`
    SELECT b.*,
           (
             SELECT COUNT(DISTINCT user_id)
             FROM (
               SELECT user_id FROM buyout_applications WHERE buyout_id = b.id
               UNION ALL
               SELECT user_id FROM auction_bids WHERE buyout_id = b.id
             )
           ) as applications_count
    FROM buyouts b
    WHERE b.status != ?
    ORDER BY b.id DESC
  `).all('cancelled');
  res.json(buyouts);
});

app.get('/api/buyouts/item/:type/:id', (req, res) => {
  let buyout = db.prepare('SELECT * FROM buyouts WHERE item_type = ? AND item_id = ? AND status != ? ORDER BY id DESC LIMIT 1').get(req.params.type, req.params.id, 'cancelled');
  
  if (buyout) {
    res.json(buyout);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Join fixed price buyout
app.post('/api/buyouts/:id/join', (req, res) => {
  const buyout_id = req.params.id;
  const { user_id, message } = req.body;
  
  try {
    const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyout_id) as any;
    if (!buyout || buyout.buyout_type !== 'fixed') return res.status(400).json({ error: 'Invalid buyout' });
    
    db.prepare('INSERT INTO buyout_applications (buyout_id, user_id, price, message) VALUES (?, ?, ?, ?)').run(buyout_id, user_id, buyout.price, message || '');
    
    // Notify creator
    io.to(`user:${buyout.creator_id}`).emit('notification');
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error joining buyout:', e);
    res.status(500).json({ error: 'Failed to join buyout' });
  }
});

// Join auction
app.post('/api/buyouts/:id/auction/join', (req, res) => {
  const buyout_id = req.params.id;
  const { user_id, min_price } = req.body;
  
  try {
    const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyout_id) as any;
    if (!buyout || buyout.buyout_type !== 'auction') return res.status(400).json({ error: 'Invalid buyout' });
    if (min_price < buyout.price) return res.status(400).json({ error: 'Minimum price must be higher than creator minimum price' });
    
    db.prepare('INSERT INTO buyout_applications (buyout_id, user_id, price) VALUES (?, ?, ?)').run(buyout_id, user_id, min_price);
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error joining auction:', e);
    res.status(500).json({ error: 'Failed to join auction' });
  }
});

// Get applications for a buyout
app.get('/api/buyouts/:id/applications', (req, res) => {
  const buyout = db.prepare('SELECT buyout_type FROM buyouts WHERE id = ?').get(req.params.id) as any;
  if (buyout?.buyout_type === 'auction') {
    const applications = db.prepare(`
      SELECT 
        MAX(id) as id,
        user_id,
        MAX(price) as price,
        '' as message,
        COALESCE((SELECT status FROM buyout_applications WHERE buyout_id = ? AND user_id = sub.user_id LIMIT 1), 'pending') as status,
        MAX(created_at) as created_at,
        username as user_name,
        avatar as user_avatar,
        account_type
      FROM (
        SELECT ba.id, ba.user_id, ba.price, ba.created_at, users.username, users.avatar, users.account_type 
        FROM buyout_applications ba JOIN users ON ba.user_id = users.id WHERE ba.buyout_id = ?
        UNION ALL
        SELECT ab.id, ab.user_id, ab.amount as price, ab.created_at, users.username, users.avatar, users.account_type 
        FROM auction_bids ab JOIN users ON ab.user_id = users.id WHERE ab.buyout_id = ?
      ) sub
      GROUP BY user_id
      ORDER BY price DESC
    `).all(req.params.id, req.params.id, req.params.id);
    return res.json(applications);
  }

  const applications = db.prepare(`
    SELECT ba.*, users.username as user_name, users.avatar as user_avatar, users.account_type 
    FROM buyout_applications ba 
    JOIN users ON ba.user_id = users.id 
    WHERE ba.buyout_id = ?
  `).all(req.params.id);
  res.json(applications);
});

// Auction bids
app.get('/api/buyouts/:id/bids', (req, res) => {
  const bids = db.prepare(`
    SELECT ab.*, users.username, users.avatar
    FROM auction_bids ab
    JOIN users ON ab.user_id = users.id
    WHERE ab.buyout_id = ?
    ORDER BY ab.created_at ASC
  `).all(req.params.id);
  res.json(bids);
});

app.post('/api/buyouts/:id/bids', (req, res) => {
  const buyout_id = req.params.id;
  const { user_id, amount } = req.body;
  
  try {
    const highestBid = db.prepare('SELECT MAX(amount) as max_amount FROM auction_bids WHERE buyout_id = ?').get(buyout_id) as any;
    const currentMax = highestBid?.max_amount || 0;
    
    if (amount <= currentMax) {
      return res.status(400).json({ error: 'Bid must be higher than current highest bid' });
    }
    
    db.prepare('INSERT INTO auction_bids (buyout_id, user_id, amount) VALUES (?, ?, ?)').run(buyout_id, user_id, amount);
    
    // Broadcast to chat
    io.to(`buyout:${buyout_id}`).emit('new_bid');
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to bid' });
  }
});

// Select applicant (Fixed Price)
app.post('/api/buyouts/:id/select', (req, res) => {
  console.log("HIT /api/buyouts/:id/select", req.params.id, req.body);
  const buyout_id = req.params.id;
  const { user_id, current_user_id } = req.body;
  try {
    const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyout_id) as any;
    if (!buyout) return res.status(404).json({ error: 'Not found' });
    if (current_user_id && Number(buyout.creator_id) !== Number(current_user_id)) return res.status(403).json({ error: 'Forbidden' });
    db.prepare('UPDATE buyouts SET winner_id = ?, winning_price = ?, status = ? WHERE id = ?').run(user_id, buyout.price, 'completed', buyout_id);
    db.prepare('UPDATE buyout_applications SET status = ? WHERE buyout_id = ? AND user_id = ?').run('selected', buyout_id, user_id);
    db.prepare('UPDATE buyout_applications SET status = ? WHERE buyout_id = ? AND user_id != ?').run('rejected', buyout_id, user_id);
    
    // Notify winner
    db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(user_id, 'buyout_won', buyout.creator_id, buyout_id, 'buyout');
    io.to(`user:${user_id}`).emit('notification');
    
    res.json({ success: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed' });
  }
});

// Complete auction and select highest bidder
app.post('/api/buyouts/:id/auction/complete', (req, res) => {
  const buyout_id = req.params.id;
  const { current_user_id } = req.body;
  try {
    const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyout_id) as any;
    if (!buyout) return res.status(404).json({ error: 'Not found' });
    if (current_user_id && Number(buyout.creator_id) !== Number(current_user_id)) return res.status(403).json({ error: 'Forbidden' });
    if (buyout.buyout_type !== 'auction') return res.status(400).json({ error: 'Not an auction' });
    
    const highestBid = db.prepare('SELECT user_id, amount FROM auction_bids WHERE buyout_id = ? ORDER BY amount DESC LIMIT 1').get(buyout_id) as any;
    if (!highestBid) return res.status(400).json({ error: 'No bids' });
    
    db.prepare('UPDATE buyouts SET winner_id = ?, winning_price = ?, status = ? WHERE id = ?').run(highestBid.user_id, highestBid.amount, 'completed', buyout_id);
    
    // Create an application entry to show as winner in UI if not exists
    db.prepare('INSERT OR IGNORE INTO buyout_applications (buyout_id, user_id, price, status) VALUES (?, ?, ?, ?)').run(buyout_id, highestBid.user_id, highestBid.amount, 'selected');
    db.prepare('UPDATE buyout_applications SET status = ? WHERE buyout_id = ? AND user_id = ?').run('selected', buyout_id, highestBid.user_id);
    
    // Notify winner
    db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(highestBid.user_id, 'buyout_won', buyout.creator_id, buyout_id, 'buyout');
    io.to(`user:${highestBid.user_id}`).emit('notification');
    
    res.json({ success: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Failed' });
  }
});

// --- End Buyout APIs ---

// Payment success (transfer ownership)
app.post('/api/buyouts/:id/transfer', (req, res) => {
  const buyout_id = req.params.id;
  try {
    const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyout_id) as any;
    if (buyout.status !== 'completed' || !buyout.winner_id) return res.status(400).json({ error: 'Not completed' });
    
    // Transfer ownership
    if (buyout.item_type === 'idea') {
      db.prepare('UPDATE ideas SET author_id = ?, is_buyout = 0 WHERE id = ?').run(buyout.winner_id, buyout.item_id);
      db.prepare('UPDATE memos SET user_id = ? WHERE item_type = ? AND item_id = ? AND user_id = ?').run(buyout.winner_id, 'idea', buyout.item_id, buyout.creator_id);
    } else {
      
      db.prepare('UPDATE projects SET author_id = ?, is_buyout = 0 WHERE id = ?').run(buyout.winner_id, buyout.item_id);
      db.prepare('UPDATE memos SET user_id = ? WHERE project_id = ? AND user_id = ?').run(buyout.winner_id, buyout.item_id, buyout.creator_id);
      
      // Transfer ownership of all descendant IDEAs
      db.prepare(`
        WITH RECURSIVE idea_tree AS (
          SELECT id FROM ideas WHERE quoted_item_id = ? AND quoted_item_type = 'project'
          UNION ALL
          SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
        )
        UPDATE ideas SET author_id = ? WHERE id IN (SELECT id FROM idea_tree)
      `).run(buyout.item_id, buyout.winner_id);

    }
    
    // Notify creator
    db.prepare('UPDATE buyouts SET status = ? WHERE id = ?').run('paid', buyout.id);
    db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(buyout.creator_id, 'buyout_paid', buyout.winner_id, buyout_id, 'buyout');
    io.to(`user:${buyout.creator_id}`).emit('notification');
    
    // Notify winner
    db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(buyout.winner_id, 'buyout_paid', buyout.creator_id, buyout_id, 'buyout');
    io.to(`user:${buyout.winner_id}`).emit('notification');
    
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Transfer failed' });
  }
});
  app.post('/api/ideas', (req, res) => {
    let { title, description, image, stage = 1, is_private = 0, is_recruitment = 0, is_edit_proposal = 0, proposed_type = 'revision' } = req.body;
    const author_id = req.body.author_id || req.body.user_id || req.body.userId;
    const quoted_item_id = req.body.quoted_item_id !== undefined && req.body.quoted_item_id !== null ? Number(req.body.quoted_item_id) : null;
    const quoted_item_type = req.body.quoted_item_type || null;
    const tags = typeof req.body.tags === 'string' ? req.body.tags : JSON.stringify(req.body.tags || []);
    let permitted_users = typeof req.body.permitted_users === 'string' ? req.body.permitted_users : JSON.stringify(req.body.permitted_users || []);
    image = image || 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=800&h=1200&fit=crop&q=80';

    console.log('Posting idea:', { title, author_id, quoted_item_id, quoted_item_type, stage, is_private, is_recruitment, tags, is_edit_proposal, proposed_type });

    if (quoted_item_id && quoted_item_type === 'project') {
      try {
        const quotedProject = db.prepare('SELECT is_private, author_id FROM projects WHERE id = ?').get(quoted_item_id) as any;
        if (quotedProject && quotedProject.is_private === 1) {
          is_private = 1;
          permitted_users = JSON.stringify([quotedProject.author_id]);
        }
      } catch (e) {
        console.error('Error fetching quoted project for privacy check:', e);
      }
    } else if (quoted_item_id && quoted_item_type === 'idea') {
      try {
        const quotedIdea = db.prepare('SELECT is_private, author_id FROM ideas WHERE id = ?').get(quoted_item_id) as any;
        if (quotedIdea && quotedIdea.is_private === 1) {
          is_private = 1;
          permitted_users = JSON.stringify([quotedIdea.author_id]);
        }
      } catch (e) {
        console.error('Error fetching quoted idea for privacy check:', e);
      }
    }
  
    if (!author_id || !userExists(author_id)) {
      console.error('User not found for author_id:', author_id);
      return res.status(400).json({ error: 'User not found' });
    }
  
    try {
      if (is_edit_proposal) {
        let rootCheck = quoted_item_id && quoted_item_type ? getRootProject(quoted_item_id, quoted_item_type) : null;
        if (!rootCheck && quoted_item_type === 'project') rootCheck = quoted_item_id;
        if (rootCheck && !isProjectMember(rootCheck, author_id)) {
          return res.status(403).json({ error: '編集提案はプロジェクト参加者のみ提出可能です' });
        }
      }

      const status = is_edit_proposal ? 'pending_approval' : 'active';
      const info = db.prepare('INSERT INTO ideas (title, description, image, author_id, quoted_item_id, quoted_item_type, stage, is_private, permitted_users, tags, is_recruitment, status, proposed_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(title, description, image, author_id, quoted_item_id, quoted_item_type, stage, is_private ? 1 : 0, permitted_users, tags, is_recruitment ? 1 : 0, status, proposed_type);
      
      const newIdeaId = info.lastInsertRowid;
      let rootProjectId: number | null = null;
      if (quoted_item_id && quoted_item_type) {
        rootProjectId = getRootProject(quoted_item_id, quoted_item_type);
        if (!rootProjectId && quoted_item_type === 'project') {
          rootProjectId = quoted_item_id;
        }
      }

      if (is_edit_proposal && quoted_item_id && quoted_item_type) {
        const room = rootProjectId ? `project:${rootProjectId}` : `${quoted_item_type}:${quoted_item_id}`;
        const meta = JSON.stringify({
           proposal_id: newIdeaId,
           proposal_title: title,
           author_id: author_id
        });
        const idea_id = rootProjectId ? null : (quoted_item_type === 'idea' ? quoted_item_id : null);
        const project_id = rootProjectId || (quoted_item_type === 'project' ? quoted_item_id : null);
        const msgInfo = db.prepare('INSERT INTO messages (idea_id, project_id, user_id, type, content, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(idea_id, project_id, author_id, 'edit_proposal', 'New Edit Proposal', meta);
        const msgId = msgInfo.lastInsertRowid;
        db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').run(msgId, author_id);
        const msg = db.prepare('SELECT m.*, u.username, u.avatar FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?').get(msgId);
        io.to(room).emit('new_message', msg);
      }

      if (quoted_item_id && quoted_item_type && !is_edit_proposal) {
        if (rootProjectId) {
          db.prepare('UPDATE projects SET latest_idea_id = ?, latest_idea_at = CURRENT_TIMESTAMP WHERE id = ?').run(newIdeaId, rootProjectId);
        }
      }

      if (is_private && permitted_users) {
        let pIds: number[] = [];
        try { pIds = JSON.parse(permitted_users); } catch(e) {}
        if (pIds.length > 0) {
          const subscribers = db.prepare('SELECT subscriber_id FROM subscriptions WHERE subscribed_to_id = ?').all(author_id) as any[];
          const subscriberIds = subscribers.map(s => s.subscriber_id);
          for (const pId of pIds) {
            if (subscriberIds.includes(pId) && pId !== author_id) {
              db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(pId, 'private_post', author_id, newIdeaId, 'idea');
              io.to(`user:${pId}`).emit('notification');
            }
          }
        }
      }

      const idea = db.prepare(`
        SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, ideas.stage as stage, ideas.is_recruitment, ideas.is_buyout, ideas.buyout_price, ideas.is_private, ideas.permitted_users,
               strftime('%Y-%m-%dT%H:%M:%SZ', ideas.created_at) as created_at,
               users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan
        FROM ideas
        JOIN users ON ideas.author_id = users.id
        WHERE ideas.id = ?
      `).get(newIdeaId);
      console.log('Idea posted successfully:', idea);
      res.json({ ...(idea as any), rootProjectId });
    } catch (e) {
      console.error('Error posting idea:', e);
      res.status(500).json({ error: 'Failed to post idea' });
    }
  });
  
  // Post project
  app.post('/api/projects', (req, res) => {
    const { title, description, stage = 1, is_private = 0, is_recruitment = 0 } = req.body;
    const author_id = req.body.author_id || req.body.user_id || req.body.userId;
    const quoted_item_id = req.body.quoted_item_id !== undefined && req.body.quoted_item_id !== null ? Number(req.body.quoted_item_id) : null;
    const quoted_item_type = req.body.quoted_item_type || null;
    const tags = typeof req.body.tags === 'string' ? req.body.tags : JSON.stringify(req.body.tags || []);
    const permitted_users = typeof req.body.permitted_users === 'string' ? req.body.permitted_users : JSON.stringify(req.body.permitted_users || []);
    const image = req.body.image || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200';

    console.log('Posting project:', { title, author_id, quoted_item_id, quoted_item_type, stage, is_private, is_recruitment, tags });

    if (!author_id || !userExists(author_id)) {
      console.error('User not found for author_id:', author_id);
      return res.status(400).json({ error: 'User not found' });
    }
  
    try {
      const info = db.prepare('INSERT INTO projects (title, description, image, author_id, quoted_item_id, quoted_item_type, stage, is_private, permitted_users, tags, is_recruitment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        title || 'Untitled Vision', 
        description || '', 
        image, 
        author_id, 
        quoted_item_id, 
        quoted_item_type, 
        stage || 1, 
        is_private ? 1 : 0, 
        permitted_users, 
        tags, 
        is_recruitment ? 1 : 0
      );
      
      const newProjectId = info.lastInsertRowid;

      if (is_private && permitted_users) {
        let pIds: number[] = [];
        try { pIds = JSON.parse(permitted_users); } catch(e) {}
        if (pIds.length > 0) {
          if (is_recruitment) {
            for (const pId of pIds) {
              if (pId !== author_id) {
                db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(pId, 'offer', author_id, newProjectId, 'project');
                io.to(`user:${pId}`).emit('notification');
              }
            }
          } else {
            const subscribers = db.prepare('SELECT subscriber_id FROM subscriptions WHERE subscribed_to_id = ?').all(author_id) as any[];
            const subscriberIds = subscribers.map(s => s.subscriber_id);
            for (const pId of pIds) {
              if (subscriberIds.includes(pId) && pId !== author_id) {
                db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(pId, 'private_post', author_id, newProjectId, 'project');
                io.to(`user:${pId}`).emit('notification');
              }
            }
          }
        }
      }

      const project = db.prepare(`
        SELECT projects.id, projects.title, projects.description, projects.image, projects.images, projects.completed_title, projects.completed_description, projects.completed_images, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type, projects.stage as stage, projects.is_recruitment, projects.is_buyout, projects.buyout_price, projects.is_private, projects.permitted_users, latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at,
               projects.is_private, projects.permitted_users,
               strftime('%Y-%m-%dT%H:%M:%SZ', projects.created_at) as created_at,
               users.username as author_name, users.avatar as author_avatar, users.account_type as author_account_type, users.org_plan as author_org_plan
        FROM projects
        JOIN users ON projects.author_id = users.id
        WHERE projects.id = ?
      `).get(info.lastInsertRowid);
      console.log('Project posted successfully:', project);
      res.json(project);
    } catch (e) {
      console.error('Error posting project:', e);
      res.status(500).json({ error: 'Failed to post project' });
    }
  });

// Follow an idea
app.post('/api/ideas/:id/follow', (req, res) => {
  const { follower_id, reason, skills, role, period, hours, message } = req.body;
  const idea_id = req.params.id;
  
  if (!userExists(follower_id)) {
    return res.status(400).json({ error: 'User not found' });
  }

  const existing = db.prepare('SELECT id FROM idea_follows WHERE idea_id = ? AND follower_id = ? AND status != \'rejected\' AND status != \'withdrawn\' AND status != \'left\' AND status != \'removed\'').get(idea_id, follower_id);
  if (existing) {
    return res.status(400).json({ error: 'Already applied or following' });
  }


  try {
    const info = db.prepare('INSERT INTO idea_follows (idea_id, follower_id, reason, skills, role, period, hours, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(idea_id, follower_id, reason, skills, role, period, hours, message);
    const follow_id = info.lastInsertRowid;
    
    // Notify the idea author
    const idea = db.prepare('SELECT author_id FROM ideas WHERE id = ?').get(idea_id) as any;
    if (idea) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
        VALUES (?, 'follow_request', ?, ?, 'idea', ?)
      `).run(idea.author_id, follower_id, idea_id, follow_id);

      io.to(`user:${idea.author_id}`).emit('notification', {
        type: 'follow_request',
        idea_id,
        follower_id,
        follow_id
      });
    }
    
    res.json({ id: follow_id });
  } catch (e) {
    res.status(400).json({ error: 'Already following' });
  }
});

// Get notifications
app.get('/api/users/:id/notifications', (req, res) => {
  const user_id = req.params.id;
  const notifications = db.prepare(`
    SELECT n.*, 
           COALESCE(i.title, p.title, bi.title, bp.title, sch.title) as idea_title, 
           COALESCE(i.id, p.id, bi.id, bp.id, sch.project_id, sch.idea_id) as resolved_item_id,
           COALESCE(i.is_buyout, p.is_buyout, 0) as is_buyout,
           CASE 
             WHEN i.id IS NOT NULL THEN 'idea'
             WHEN p.id IS NOT NULL THEN 'project'
             WHEN bi.id IS NOT NULL THEN 'idea'
             WHEN bp.id IS NOT NULL THEN 'project'
             WHEN sch.project_id IS NOT NULL THEN 'project'
             WHEN sch.idea_id IS NOT NULL THEN 'idea'
             ELSE n.item_type
           END as resolved_item_type,
           sch.id as schedule_id,
           u.username as from_user_name, 
           u.avatar as from_user_avatar,
           u.account_type as from_user_account_type,
           b.status as buyout_status,
           f.reason as follow_reason,
           f.skills as follow_skills,
           f.role as follow_role,
           f.period as follow_period,
           f.hours as follow_hours,
           f.message as follow_message
    FROM notifications n
    JOIN users u ON n.from_user_id = u.id
    LEFT JOIN idea_follows f ON n.follow_id = f.id
    LEFT JOIN ideas i ON n.item_id = i.id AND n.item_type = 'idea'
    LEFT JOIN projects p ON n.item_id = p.id AND n.item_type = 'project'
    LEFT JOIN buyouts b ON n.item_id = b.id AND n.item_type = 'buyout'
    LEFT JOIN ideas bi ON b.item_id = bi.id AND b.item_type = 'idea'
    LEFT JOIN projects bp ON b.item_id = bp.id AND b.item_type = 'project'
    LEFT JOIN schedules sch ON n.item_id = sch.id AND n.item_type = 'schedule'
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
  `).all(user_id);
  res.json(notifications);
});

// Mark all notifications as read for a user
app.post('/api/users/:id/notifications/read', (req, res) => {
  const user_id = req.params.id;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user_id);
  res.json({ success: true });
});

// Mark specific offer notification as read
app.post('/api/users/:id/notifications/read_offer/:item_id', (req, res) => {
  const user_id = req.params.id;
  const item_id = req.params.item_id;
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND item_id = ? AND type = 'offer'").run(user_id, item_id);
  res.json({ success: true });
});


// Reject follow request
app.post('/api/follows/:id/reject', (req, res) => {
  const follow_id = req.params.id;
  const { message } = req.body || {};
  db.prepare("UPDATE idea_follows SET status = 'rejected' WHERE id = ?").run(follow_id);
  
  const follow = db.prepare('SELECT * FROM idea_follows WHERE id = ?').get(follow_id) as any;
  if (follow) {
    const item_id = follow.idea_id || follow.project_id;
    const item_type = follow.idea_id ? 'idea' : 'project';
    const item = db.prepare(`SELECT title, author_id FROM ${item_type === 'idea' ? 'ideas' : 'projects'} WHERE id = ?`).get(item_id) as any;
    
    // Notify the follower with the rejection comment
    db.prepare(`
      INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id, message)
      VALUES (?, 'follow_rejected', ?, ?, ?, ?, ?)
    `).run(follow.follower_id, item.author_id, item_id, item_type, follow_id, message);
    
    io.to(`user:${follow.follower_id}`).emit('notification', { type: 'follow_rejected', item_id, idea_title: item.title });
    
    // Delete the original request notification so it doesn't linger
    db.prepare("DELETE FROM notifications WHERE type = 'follow_request' AND follow_id = ?").run(follow_id);
  }
  res.json({ success: true });
});

// Follow back (accept follow or invitation)
app.post('/api/follows/:id/accept', (req, res) => {
  const follow_id = req.params.id;
  db.prepare("UPDATE idea_follows SET is_mutual = 1, status = 'approved' WHERE id = ?").run(follow_id);
  
  const follow = db.prepare('SELECT * FROM idea_follows WHERE id = ?').get(follow_id) as any;
  if (follow) {
    const item_id = follow.idea_id || follow.project_id;
    const item_type = follow.idea_id ? 'idea' : 'project';
    const item = db.prepare(`SELECT title, author_id FROM ${item_type === 'idea' ? 'ideas' : 'projects'} WHERE id = ?`).get(item_id) as any;

    // Check if it was an invitation
    const invitation = db.prepare("SELECT * FROM notifications WHERE type = 'invitation' AND follow_id = ?").get(follow_id) as any;
    
    if (invitation) {
      // User accepted invitation, notify the author
      db.prepare(`
        INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
        VALUES (?, 'follow_accepted', ?, ?, ?, ?)
      `).run(item.author_id, follow.follower_id, item_id, item_type, follow_id);
      
      io.to(`user:${item.author_id}`).emit('notification', { type: 'follow_accepted', item_id, idea_title: item.title });
      
      // Notify chat room that a new member joined
      const room = `${item_type}:${item_id}`;
      io.to(room).emit('member_joined', { id: follow.follower_id });

      // Delete the invitation notification
      db.prepare('DELETE FROM notifications WHERE id = ?').run(invitation.id);
    } else {
      // Author accepted follow request, notify the follower
      db.prepare(`
        INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
        VALUES (?, 'follow_accepted', ?, ?, ?, ?)
      `).run(follow.follower_id, item.author_id, item_id, item_type, follow_id);

      // Delete the original request notification
      db.prepare("DELETE FROM notifications WHERE type = 'follow_request' AND follow_id = ?").run(follow_id);
      
      io.to(`user:${follow.follower_id}`).emit('notification', { type: 'follow_accepted', item_id, idea_title: item.title });
      
      // Notify chat room that a new member joined
      const room = `${item_type}:${item_id}`;
      io.to(room).emit('member_joined', { id: follow.follower_id });

      // Delete the request notification
      db.prepare(`
        DELETE FROM notifications 
        WHERE user_id = ? AND type = 'follow_request' AND from_user_id = ? AND item_id = ?
      `).run(item.author_id, follow.follower_id, item_id);
    }
  }
  
  res.json({ success: true });
});

// Mark all messages in a chat as read
app.post('/api/chats/mark_read', (req, res) => {
  const { user_id, project_id, idea_id, recipient_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  try {
    if (project_id) {
      db.prepare(`
        INSERT OR IGNORE INTO message_reads (message_id, user_id)
        SELECT id, ? FROM messages WHERE project_id = ? AND user_id != ?
      `).run(user_id, project_id, user_id);
    } else if (idea_id) {
      db.prepare(`
        INSERT OR IGNORE INTO message_reads (message_id, user_id)
        SELECT id, ? FROM messages WHERE idea_id = ? AND user_id != ?
      `).run(user_id, idea_id, user_id);
    } else if (recipient_id) {
      db.prepare(`
        INSERT OR IGNORE INTO message_reads (message_id, user_id)
        SELECT id, ? FROM messages WHERE user_id = ? AND recipient_id = ?
      `).run(user_id, recipient_id, user_id);
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Error marking chat as read:', e);
    res.status(500).json({ error: 'Failed to mark chat as read' });
  }
});

// Get user memberships (ideas, projects, and direct chats where user is participant)
app.get('/api/users/:id/memberships', (req, res) => {
  const user_id = req.params.id;
  const memberships = db.prepare(`
    SELECT DISTINCT p.id, p.title, p.description, p.image, p.author_id, p.latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', p.latest_idea_at) as latest_idea_at, 'project' as type,
           p.status as project_status,
           (SELECT COUNT(*) FROM idea_follows WHERE project_id = p.id AND is_mutual = 1) + 1 as members_count,
           strftime('%Y-%m-%dT%H:%M:%SZ', p.created_at) as created_at,
           u.username as author_name, u.avatar as author_avatar, u.account_type as account_type,
           (SELECT content FROM messages WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT type FROM messages WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
           (SELECT strftime('%Y-%m-%dT%H:%M:%SZ', created_at) FROM messages WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
           (SELECT user_id FROM messages WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1) as last_message_user_id,
           (SELECT COUNT(*) FROM message_reads WHERE message_id = (SELECT id FROM messages WHERE project_id = p.id ORDER BY created_at DESC LIMIT 1)) as last_message_read_count,
           (SELECT COUNT(*) FROM messages m WHERE m.project_id = p.id AND m.user_id != ? AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)) as unread_count
    FROM projects p
    JOIN users u ON p.author_id = u.id
    WHERE p.author_id = ? 
       OR EXISTS (SELECT 1 FROM idea_follows f WHERE f.project_id = p.id AND f.follower_id = ? AND f.is_mutual = 1)
       OR EXISTS (SELECT 1 FROM messages m3 WHERE m3.project_id = p.id AND m3.user_id = ?)
    UNION
    SELECT DISTINCT i.id, i.title, i.description, i.image, i.author_id, i.id as latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', i.created_at) as latest_idea_at, 'idea' as type,
           i.status as project_status,
           (SELECT COUNT(*) FROM idea_follows WHERE idea_id = i.id AND is_mutual = 1) + 1 as members_count,
           strftime('%Y-%m-%dT%H:%M:%SZ', i.created_at) as created_at,
           u.username as author_name, u.avatar as author_avatar, u.account_type as account_type,
           (SELECT content FROM messages WHERE idea_id = i.id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT type FROM messages WHERE idea_id = i.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
           (SELECT strftime('%Y-%m-%dT%H:%M:%SZ', created_at) FROM messages WHERE idea_id = i.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
           (SELECT user_id FROM messages WHERE idea_id = i.id ORDER BY created_at DESC LIMIT 1) as last_message_user_id,
           (SELECT COUNT(*) FROM message_reads WHERE message_id = (SELECT id FROM messages WHERE idea_id = i.id ORDER BY created_at DESC LIMIT 1)) as last_message_read_count,
           (SELECT COUNT(*) FROM messages m WHERE m.idea_id = i.id AND m.user_id != ? AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)) as unread_count
    FROM ideas i
    JOIN users u ON i.author_id = u.id
    WHERE (i.author_id = ? 
       OR EXISTS (SELECT 1 FROM idea_follows f WHERE f.idea_id = i.id AND f.follower_id = ? AND f.is_mutual = 1)
       OR EXISTS (SELECT 1 FROM messages m4 WHERE m4.idea_id = i.id AND m4.user_id = ?))
    AND EXISTS (SELECT 1 FROM messages WHERE idea_id = i.id)
    AND i.status = 'active'
    AND (i.quoted_item_type IS NULL OR i.quoted_item_type != 'project')
    UNION
    SELECT DISTINCT u.id, u.username as title, '' as description, u.avatar as image, u.id as author_id, NULL as latest_idea_id, NULL as latest_idea_at, 'direct' as type,
           'active' as project_status,
           2 as members_count,
           strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at) as created_at,
           u.username as author_name, u.avatar as author_avatar, u.account_type as account_type,
           m.content as last_message,
           m.type as last_message_type,
           strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at) as last_message_at,
           m.user_id as last_message_user_id,
           (SELECT COUNT(*) FROM message_reads WHERE message_id = m.id) as last_message_read_count,
           (SELECT COUNT(*) FROM messages m2 WHERE m2.user_id = u.id AND m2.recipient_id = ? AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m2.id AND mr.user_id = ?)) as unread_count
    FROM messages m
    JOIN users u ON (m.user_id = u.id AND m.recipient_id = ?) OR (m.recipient_id = u.id AND m.user_id = ?)
    WHERE (m.user_id = ? OR m.recipient_id = ?) AND m.recipient_id IS NOT NULL
    AND m.id = (
      SELECT id FROM messages 
      WHERE (user_id = ? AND recipient_id = u.id) OR (user_id = u.id AND recipient_id = ?)
      ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY last_message_at DESC, created_at DESC
  `).all(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  res.json(memberships);
});

// Get followers for an idea (not yet mutual)
app.get('/api/ideas/:id/followers', (req, res) => {
  const idea_id = req.params.id;
  const followers = db.prepare(`
    SELECT users.id, users.username, users.avatar
    FROM idea_follows
    JOIN users ON idea_follows.follower_id = users.id
    WHERE idea_follows.idea_id = ? AND idea_follows.is_mutual = 0 AND idea_follows.id NOT IN (
      SELECT follow_id FROM notifications WHERE type = 'invitation' AND item_id = ? AND item_type = 'idea'
    )
  `).all(idea_id, idea_id);
  res.json(followers);
});

// Get followers for a project (not yet mutual)
app.get('/api/projects/:id/followers', (req, res) => {
  const project_id = req.params.id;
  const followers = db.prepare(`
    SELECT users.id, users.username, users.avatar
    FROM idea_follows
    JOIN users ON idea_follows.follower_id = users.id
    WHERE idea_follows.project_id = ? AND idea_follows.is_mutual = 0 AND idea_follows.id NOT IN (
      SELECT follow_id FROM notifications WHERE type = 'invitation' AND item_id = ? AND item_type = 'project'
    )
  `).all(project_id, project_id);
  res.json(followers);
});

// Get contacts for a user
app.get('/api/users/:id/contacts', (req, res) => {
  const user_id = req.params.id;
  const { item_id, item_type } = req.query;
  
  const contacts = db.prepare(`
    SELECT DISTINCT u.id, u.username, u.avatar
    FROM users u
    JOIN idea_follows f ON u.id = f.follower_id
    WHERE f.is_mutual = 1 AND (f.idea_id IN (
      SELECT idea_id FROM idea_follows WHERE follower_id = ? AND is_mutual = 1
      UNION
      SELECT id FROM ideas WHERE author_id = ?
    ) OR f.project_id IN (
      SELECT project_id FROM idea_follows WHERE follower_id = ? AND is_mutual = 1
      UNION
      SELECT id FROM projects WHERE author_id = ?
    ))
    AND u.id != ?
    AND u.id NOT IN (
      SELECT follower_id FROM idea_follows WHERE ${item_type === 'idea' ? 'idea_id' : 'project_id'} = ?
    )
    UNION
    SELECT DISTINCT u.id, u.username, u.avatar
    FROM users u
    JOIN ideas i ON u.id = i.author_id
    WHERE i.id IN (
      SELECT idea_id FROM idea_follows WHERE follower_id = ? AND is_mutual = 1
    )
    AND u.id != ?
    AND u.id NOT IN (
      SELECT follower_id FROM idea_follows WHERE ${item_type === 'idea' ? 'idea_id' : 'project_id'} = ?
    )
    UNION
    SELECT DISTINCT u.id, u.username, u.avatar
    FROM users u
    JOIN projects p ON u.id = p.author_id
    WHERE p.id IN (
      SELECT project_id FROM idea_follows WHERE follower_id = ? AND is_mutual = 1
    )
    AND u.id != ?
    AND u.id NOT IN (
      SELECT follower_id FROM idea_follows WHERE ${item_type === 'idea' ? 'idea_id' : 'project_id'} = ?
    )
  `).all(user_id, user_id, user_id, user_id, user_id, item_id, user_id, user_id, item_id, user_id, user_id, item_id);
  res.json(contacts);
});

// Bulk add members to idea
app.post('/api/ideas/:id/members/bulk', (req, res) => {
  const idea_id = req.params.id;
  const { user_ids } = req.body;

  const transaction = db.transaction((ids) => {
    for (const uid of ids) {
      const existing = db.prepare('SELECT id, is_mutual FROM idea_follows WHERE idea_id = ? AND follower_id = ?').get(idea_id, uid) as any;
      const idea = db.prepare('SELECT title, author_id FROM ideas WHERE id = ?').get(idea_id) as any;

          if (existing) {
            if (existing.is_mutual === 0) {
              // Accept follow request
              db.prepare('UPDATE idea_follows SET is_mutual = 1 WHERE id = ?').run(existing.id);
              
              db.prepare(`
                INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
                VALUES (?, 'follow_accepted', ?, ?, 'idea', ?)
              `).run(uid, idea.author_id, idea_id, existing.id);
          
          db.prepare(`
            DELETE FROM notifications 
            WHERE user_id = ? AND type = 'follow_request' AND from_user_id = ? AND item_id = ?
          `).run(idea.author_id, uid, idea_id);
          
          io.to(`user:${uid}`).emit('notification', { type: 'follow_accepted', idea_id, idea_title: idea.title });
        }
      } else {
        // Send invitation
        const info = db.prepare('INSERT INTO idea_follows (idea_id, follower_id, is_mutual) VALUES (?, ?, 0)').run(idea_id, uid);
        const follow_id = info.lastInsertRowid;
        
        db.prepare(`
          INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
          VALUES (?, 'invitation', ?, ?, 'idea', ?)
        `).run(uid, idea.author_id, idea_id, follow_id);
        
        io.to(`user:${uid}`).emit('notification', { type: 'invitation', idea_id, idea_title: idea.title });
      }
    }
  });

  transaction(user_ids);
  res.json({ success: true });
});

// Bulk add members to project
app.post('/api/projects/:id/members/bulk', (req, res) => {
  const project_id = req.params.id;
  const { user_ids } = req.body;

  const transaction = db.transaction((ids) => {
    for (const uid of ids) {
      const existing = db.prepare('SELECT id, is_mutual FROM idea_follows WHERE project_id = ? AND follower_id = ?').get(project_id, uid) as any;
      const project = db.prepare('SELECT title, author_id FROM projects WHERE id = ?').get(project_id) as any;

      if (existing) {
        if (existing.is_mutual === 0) {
          // Accept follow request
          db.prepare('UPDATE idea_follows SET is_mutual = 1 WHERE id = ?').run(existing.id);
          
          db.prepare(`
            INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
            VALUES (?, 'follow_accepted', ?, ?, 'project', ?)
          `).run(uid, project.author_id, project_id, existing.id);
          
          db.prepare(`
            DELETE FROM notifications 
            WHERE user_id = ? AND type = 'follow_request' AND from_user_id = ? AND item_id = ?
          `).run(project.author_id, uid, project_id);
          
          io.to(`user:${uid}`).emit('notification', { type: 'follow_accepted', project_id, idea_title: project.title });
        }
      } else {
        // Send invitation
        const info = db.prepare('INSERT INTO idea_follows (project_id, follower_id, is_mutual) VALUES (?, ?, 0)').run(project_id, uid);
        const follow_id = info.lastInsertRowid;
        
        db.prepare(`
          INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
          VALUES (?, 'invitation', ?, ?, 'project', ?)
        `).run(uid, project.author_id, project_id, follow_id);
        
        io.to(`user:${uid}`).emit('notification', { type: 'invitation', project_id, idea_title: project.title });
      }
    }
  });

  transaction(user_ids);
  res.json({ success: true });
});

// Get idea members (mutual followers + author)
app.get('/api/ideas/:id/members', (req, res) => {
  const idea_id = req.params.id;
  const idea = db.prepare('SELECT author_id FROM ideas WHERE id = ?').get(idea_id) as any;
  if (!idea) return res.json([]);

  const members = db.prepare(`
    SELECT users.id, users.username, users.avatar, users.account_type, 'follower' as role
    FROM idea_follows
    JOIN users ON idea_follows.follower_id = users.id
    WHERE idea_follows.idea_id = ? AND idea_follows.is_mutual = 1 AND idea_follows.follower_id != ?
    UNION ALL
    SELECT users.id, users.username, users.avatar, users.account_type, 'author' as role
    FROM ideas
    JOIN users ON ideas.author_id = users.id
    WHERE ideas.id = ?
  `).all(idea_id, idea.author_id, idea_id) as any[];

  const uniqueMap = new Map<number, any>();
  for (const m of members) {
    if (!uniqueMap.has(m.id) || m.role === 'author') {
      uniqueMap.set(m.id, m);
    }
  }
  res.json(Array.from(uniqueMap.values()));
});

// Get direct chat messages
app.get('/api/direct_chat/:other_user_id/messages', (req, res) => {
  const other_user_id = req.params.other_user_id;
  const user_id = req.query.user_id;
  const messages = db.prepare(`
    SELECT messages.id, messages.user_id, messages.recipient_id, messages.content,
           messages.type, messages.metadata,
           strftime('%Y-%m-%dT%H:%M:%SZ', messages.created_at) as created_at,
           users.username, users.avatar, users.account_type,
           (SELECT COUNT(*) FROM message_reads WHERE message_id = messages.id) as read_count,
           EXISTS (SELECT 1 FROM message_reads WHERE message_id = messages.id AND user_id = ?) as is_read
    FROM messages
    JOIN users ON messages.user_id = users.id
    WHERE (messages.user_id = ? AND messages.recipient_id = ?) OR (messages.user_id = ? AND messages.recipient_id = ?)
    ORDER BY created_at ASC
  `).all(user_id, user_id, other_user_id, other_user_id, user_id);
  res.json(messages);
});

// Get potential contacts for a user (only those they follow/subscribe to)
app.get('/api/users/:id/potential_contacts', (req, res) => {
  const user_id = req.params.id;
  const contacts = db.prepare(`
    SELECT DISTINCT u.id, u.username, u.avatar, u.account_type
    FROM users u
    WHERE u.id != ?
    AND u.id IN (SELECT subscribed_to_id FROM subscriptions WHERE subscriber_id = ?)
  `).all(user_id, user_id);
  res.json(contacts);
});

// Get chat messages
app.get('/api/ideas/:id/messages', (req, res) => {
  const idea_id = req.params.id;
  const user_id = req.query.user_id;

  if (user_id) {
    const idea = db.prepare('SELECT author_id FROM ideas WHERE id = ?').get(idea_id) as any;
    if (idea && idea.author_id != user_id) {
      const follow = db.prepare('SELECT is_mutual, status FROM idea_follows WHERE idea_id = ? AND follower_id = ?').get(idea_id, user_id) as any;
      if (!follow || follow.is_mutual !== 1 || follow.status === 'left') {
        return res.status(403).json({ error: 'プロジェクトチャットを閲覧する権限がありません。' });
      }
    }
  }

  const messages = db.prepare(`
    SELECT messages.id, messages.idea_id, messages.user_id, messages.content,
           messages.type, messages.metadata,
           strftime('%Y-%m-%dT%H:%M:%SZ', messages.created_at) as created_at,
           users.username, users.avatar, users.account_type,
           (SELECT COUNT(*) FROM message_reads WHERE message_id = messages.id) as read_count,
           EXISTS (SELECT 1 FROM message_reads WHERE message_id = messages.id AND user_id = ?) as is_read
    FROM messages
    JOIN users ON messages.user_id = users.id
    WHERE idea_id = ?
    ORDER BY created_at ASC
  `).all(user_id, idea_id);
  res.json(messages);
});

// Leave an idea
app.post('/api/ideas/:id/leave', (req, res) => {
  const idea_id = req.params.id;
  const user_id = req.body?.user_id || req.query?.user_id;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const idea = db.prepare('SELECT author_id FROM ideas WHERE id = ?').get(idea_id) as any;
  if (!idea) {
    return res.status(404).json({ error: 'Idea not found' });
  }

  if (idea.author_id == user_id) {
    return res.status(400).json({ error: 'EMA投稿者（Owner）はプロジェクトから退出できません。' });
  }

  const follow = db.prepare('SELECT id FROM idea_follows WHERE idea_id = ? AND follower_id = ?').get(idea_id, user_id) as any;
  if (follow) {
    db.prepare("UPDATE idea_follows SET is_mutual = 0, status = 'left' WHERE id = ?").run(follow.id);
  } else {
    db.prepare("INSERT INTO idea_follows (idea_id, follower_id, is_mutual, status) VALUES (?, ?, 0, 'left')").run(idea_id, user_id);
  }

  res.json({ success: true, message: 'プロジェクトから退出しました。' });
});

// Check if user is project member
app.get('/api/ideas/:id/membership', (req, res) => {
  const idea_id = req.params.id;
  const user_id = req.query.user_id;
  
  const idea = db.prepare('SELECT author_id FROM ideas WHERE id = ?').get(idea_id) as any;
  if (!idea) return res.status(404).json({ error: 'Not found' });
  
  if (idea.author_id == user_id) {
    return res.json({ isMember: true, role: 'author' });
  }
  
  const follow = db.prepare('SELECT * FROM idea_follows WHERE idea_id = ? AND follower_id = ?').get(idea_id, user_id) as any;
  if (follow && follow.is_mutual && follow.status !== 'left') {
    return res.json({ isMember: true, role: 'follower', status: 'member' });
  } else if (follow && follow.status === 'left') {
    return res.json({ isMember: false, role: 'none', status: 'left' });
  } else if (follow) {
    return res.json({ isMember: false, role: 'none', status: 'pending' });
  }
  
  res.json({ isMember: false, role: 'none', status: 'none' });
});

app.get('/api/network/:id', (req, res) => {
  const { id } = req.params;
  const { type } = req.query;

  if (!id || !type) return res.status(400).json({ error: 'Missing id or type' });

  try {
    // 1. Find the root of the quote chain
    let rootId = parseInt(id);
    let rootType = type as string;
    const visitedRootFinder = new Set<string>();

    while (true) {
      const key = `${rootType}:${rootId}`;
      if (visitedRootFinder.has(key)) {
        console.warn(`[Network Root Cycle Avoided] Cycle detected at ${key}`);
        break;
      }
      visitedRootFinder.add(key);

      const table = rootType === 'idea' ? 'ideas' : 'projects';
      const item = db.prepare(`SELECT quoted_item_id, quoted_item_type FROM ${table} WHERE id = ?`).get(rootId) as any;
      if (item && item.quoted_item_id) {
        rootId = item.quoted_item_id;
        rootType = item.quoted_item_type;
      } else {
        break;
      }
    }

    // 2. Recursive function to fetch the tree
    const visitedTreeNodes = new Set<string>();
    const fetchTree = (parentId: number, parentType: string): any => {
      const key = `${parentType}:${parentId}`;
      if (visitedTreeNodes.has(key)) {
        console.warn(`[Network Tree Cycle Avoided] Cycle detected at ${key}`);
        return null;
      }
      visitedTreeNodes.add(key);

      const table = parentType === 'idea' ? 'ideas' : 'projects';
      const item = db.prepare(`
        SELECT i.*, u.username as author_name, u.avatar as author_avatar,
        (SELECT COUNT(*) FROM likes WHERE item_id = i.id AND item_type = ?) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE ${parentType === 'idea' ? 'idea_id' : 'project_id'} = i.id) as comments_count,
        (SELECT COUNT(*) FROM archives WHERE item_id = i.id AND item_type = ?) as archives_count
        FROM ${table} i
        JOIN users u ON i.author_id = u.id
        WHERE i.id = ?
      `).get(parentType, parentType, parentId) as any;

      if (!item) return null;

      // Find children (items that quoted this parent)
      const ideaChildren = db.prepare(`
        SELECT id FROM ideas WHERE quoted_item_id = ? AND quoted_item_type = ? AND status = 'active'
      `).all(parentId, parentType) as any[];

      const projectChildren = db.prepare(`
        SELECT id FROM projects WHERE quoted_item_id = ? AND quoted_item_type = ?
      `).all(parentId, parentType) as any[];

      const children = [
        ...ideaChildren.map(c => fetchTree(c.id, 'idea')),
        ...projectChildren.map(c => fetchTree(c.id, 'project'))
      ].filter(Boolean);

      let versions: any[] = [];
      if (parentType === 'idea') {
        versions = db.prepare(`
          SELECT iv.*, 
                 u1.username as author_name, u1.avatar as author_avatar
          FROM idea_versions iv
          LEFT JOIN users u1 ON iv.author_id = u1.id
          WHERE iv.idea_id = ?
          AND iv.id IN (
            SELECT MAX(id) FROM idea_versions WHERE idea_id = ? GROUP BY version
          )
          ORDER BY iv.version ASC
        `).all(parentId, parentId) as any[];
      }

      const stripHtml = (str: string) => (str || '').replace(/<[^>]*>/g, '').trim();

      const nodeVersions = versions.length > 0 ? versions.map(v => ({
        id: item.id,
        version: v.version,
        title: v.title || item.title,
        content: stripHtml(v.description || item.description),
        description: v.description || item.description,
        image: v.image || item.image,
        author_id: v.author_id || item.author_id,
        author_name: v.author_name || item.author_name,
        author_avatar: v.author_avatar || item.author_avatar,
        type: 'idea',
        created_at: v.created_at || item.created_at,
        status: v.status
      })) : [{
        id: item.id,
        version: item.version || 1,
        title: item.title,
        content: stripHtml(item.description),
        description: item.description,
        image: item.image,
        author_id: item.author_id,
        author_name: item.author_name,
        author_avatar: item.author_avatar,
        type: parentType,
        created_at: item.created_at,
        status: item.status
      }];

      return {
        ...item,
        type: parentType,
        versions: nodeVersions,
        children
      };
    };

    const userId = req.query.user_id ? Number(req.query.user_id) : null;
    let is_member = false;
    if (userId) {
      const rootProjectId = rootType === 'project' ? rootId : getRootProject(rootId, rootType);
      if (rootProjectId) {
        is_member = isProjectMember(rootProjectId, userId);
      } else {
        const rootItem = db.prepare(`SELECT author_id FROM ${rootType === 'idea' ? 'ideas' : 'projects'} WHERE id = ?`).get(rootId) as any;
        if (rootItem && rootItem.author_id === userId) is_member = true;
      }
    }

    const tree = fetchTree(rootId, rootType);
    res.json({ ...tree, is_member });
  } catch (e) {
    console.error('Network API error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Memo API
app.get('/api/memo_folders', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  try {
    const folders = db.prepare('SELECT * FROM memo_folders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memo_folders', (req, res) => {
  const { user_id, name } = req.body;
  if (!user_id || !name) return res.status(400).json({ error: 'user_id and name required' });
  try {
    const stmt = db.prepare('INSERT INTO memo_folders (user_id, name, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const info = stmt.run(user_id, name);
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/memo_folders/:id', (req, res) => {
  const folderId = req.params.id;
  try {
    db.prepare('DELETE FROM memo_folders WHERE id = ?').run(folderId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memos', (req, res) => {
  const projectId = req.query.project_id;
  const folderId = req.query.folder_id;
  if (!projectId && !folderId) return res.status(400).json({ error: 'project_id or folder_id required' });
  try {
    if (projectId) {
      const memos = db.prepare('SELECT * FROM memos WHERE project_id = ? ORDER BY updated_at DESC').all(projectId);
      res.json(memos);
    } else {
      const memos = db.prepare('SELECT * FROM memos WHERE folder_id = ? ORDER BY updated_at DESC').all(folderId);
      res.json(memos);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memos', (req, res) => {
  const { user_id, project_id, folder_id, title, content } = req.body;
  if (!user_id || (!project_id && !folder_id)) return res.status(400).json({ error: 'user_id and either project_id or folder_id required' });
  try {
    const stmt = db.prepare('INSERT INTO memos (user_id, project_id, folder_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
    const info = stmt.run(user_id, project_id || null, folder_id || null, title || 'New Note', content || '');
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/memos/:id', (req, res) => {
  const memoId = req.params.id;
  const { title, content } = req.body;
  try {
    const stmt = db.prepare('UPDATE memos SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(title, content, memoId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/memos/:id', (req, res) => {
  const memoId = req.params.id;
  try {
    db.prepare('DELETE FROM memos WHERE id = ?').run(memoId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Stripe API ---
app.get('/api/test', (req, res) => res.json({ msg: 'working version 3' }));
app.get('/api/stripe/status', (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ connected: false });
    const user = db.prepare('SELECT stripe_account_id FROM users WHERE id = ?').get(userId) as any;
    res.json({ connected: !!user?.stripe_account_id });
  } catch (error) {
    res.status(500).json({ connected: false });
  }
});

app.post('/api/stripe/create-account', async (req, res) => {
  try {
    const { user_id } = req.body;
    const stripe = getStripe();
    console.log("HIT CREATE CHECKOUT BUYOUT", req.body);
    if (true || !stripe) { // temporarily disabled stripe for testing
      console.log("INSIDE MOCK BLOCK");
      // MOCK FOR TESTING WITHOUT STRIPE KEY
      db.prepare('UPDATE users SET stripe_account_id = ? WHERE id = ?').run('mock_acct_' + user_id, user_id);
      return res.json({ url: `${req.headers.origin}/users/${user_id}` });
    }
    
    // Check if user already has an account
    const user = db.prepare('SELECT stripe_account_id FROM users WHERE id = ?').get(user_id) as any;
    let accountId = user?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({ 
        type: 'express',
        business_type: 'individual',
        business_profile: {
          url: `${req.headers.origin}/users/${user_id}`
        },
        capabilities: {
          transfers: { requested: true }
        }
      });
      accountId = account.id;
      db.prepare('UPDATE users SET stripe_account_id = ? WHERE id = ?').run(accountId, user_id);
    }

    // Try to create a login link if account is fully onboarded, else account link
    try {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      res.json({ url: loginLink.url });
    } catch (e) {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${req.headers.origin}/api/stripe/return`,
        return_url: `${req.headers.origin}/api/stripe/return`,
        type: 'account_onboarding',
      });
      res.json({ url: accountLink.url });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stripe/return', (req, res) => {
  const type = req.query.type;
  const message = type === 'checkout' ? '決済手続きが完了しました' : '連携が完了しました';
  res.send(`
    <html>
      <head><title>Stripe Connect</title></head>
      <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: white;">
        <div style="text-align: center;">
          <h2>${message}</h2>
          <p>このタブを閉じて元の画面に戻ってください。</p>
          <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer;">閉じる</button>
        </div>
        <script>
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

app.get('/api/stripe/verify-session', async (req, res) => {
  try {
    const session_id = req.query.session_id as string;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      const purchase = db.prepare('SELECT * FROM purchases WHERE stripe_session_id = ?').get(session_id) as any;
      if (purchase && purchase.status !== 'completed') {
        db.prepare('UPDATE purchases SET status = ? WHERE stripe_session_id = ?').run('completed', session_id);
        
        // Update project funding_current
        db.prepare('UPDATE projects SET funding_current = funding_current + ? WHERE id = ?').run(purchase.amount, purchase.project_id);
      }
      res.json({ success: true, status: 'paid' });
    } else {
      res.json({ success: true, status: session.payment_status });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cart', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  try {
    const items = db.prepare(`
      SELECT c.*, pr.title as project_title, pr.completed_title as project_completed_title, pr.image as project_image, pr.images as project_images, pr.description as project_description, pr.completed_description
      FROM cart_items c
      JOIN projects pr ON c.project_id = pr.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(userId);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cart', (req, res) => {
  const { user_id, project_id } = req.body;
  if (!user_id || !project_id) return res.status(400).json({ error: 'user_id and project_id required' });
  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO cart_items (user_id, project_id) VALUES (?, ?)');
    stmt.run(user_id, project_id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cart/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  try {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND project_id = ?').run(userId, projectId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cart/check/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  try {
    const item = db.prepare('SELECT id FROM cart_items WHERE user_id = ? AND project_id = ?').get(userId, projectId);
    res.json({ inCart: !!item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/purchases', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  try {
    const purchases = db.prepare(`
      SELECT p.*, pr.title as project_title, pr.completed_title as project_completed_title, pr.image as project_image, pr.images as project_images, 'project' as item_type
      FROM purchases p
      JOIN projects pr ON p.project_id = pr.id
      WHERE p.user_id = ? AND p.status = 'completed'
    `).all(userId) as any[];
    
    const buyouts = db.prepare(`
      SELECT b.id as id, b.item_id as project_id, b.item_type, b.winning_price as amount, b.created_at, b.status,
             'Buyout' as tier_description,
             'buyout_' || b.id as stripe_session_id
      FROM buyouts b
      WHERE b.winner_id = ? AND b.status = 'paid'
    `).all(userId) as any[];
    
    for (let b of buyouts) {
      if (b.item_type === 'project') {
         const p = db.prepare('SELECT title, completed_title, image, images FROM projects WHERE id = ?').get(b.project_id);
         if (p) {
           b.project_title = (p as any).title;
           b.project_completed_title = (p as any).completed_title;
           b.project_image = (p as any).image;
           b.project_images = (p as any).images;
         }
      } else if (b.item_type === 'idea') {
         const idea = db.prepare('SELECT title, image, images FROM ideas WHERE id = ?').get(b.project_id);
         if (idea) {
           b.project_title = (idea as any).title;
           b.project_image = (idea as any).image;
           b.project_images = (idea as any).images;
         }
      }
    }

    const all = [...purchases, ...buyouts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(all);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stripe/create-checkout', async (req, res) => {
  try {

    const { project_id, amount, needs_shipping, tier_description, success_url, cancel_url, user_id } = req.body;
    const stripe = getStripe();
    console.log("HIT CREATE CHECKOUT BUYOUT", req.body);
    if (true || !stripe) { // temporarily disabled stripe for testing
      console.log("INSIDE MOCK BLOCK");
      // MOCK FOR TESTING WITHOUT STRIPE KEY
      // simulate webhook
      db.prepare('UPDATE projects SET funding_current = funding_current + ? WHERE id = ?').run(amount, project_id);
      return res.json({ url: success_url });
    }
    
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    const author = db.prepare('SELECT stripe_account_id FROM users WHERE id = ?').get(project.author_id) as any;
    // // if (!author || !author.stripe_account_id) return res.status(400).json({ error: 'Author has not connected Stripe' });

    // Assuming amount is in minimum currency unit (e.g. JPY or cents)
    const sessionConfig: any = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `Funding for: ${project.completed_title || project.title}`,
            description: tier_description || undefined,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url,
      ...(author.stripe_account_id ? {
        payment_intent_data: {
          application_fee_amount: Math.floor(amount * 0.1),
          transfer_data: {
            destination: author.stripe_account_id,
          },
        },
      } : {}),
      metadata: {
        project_id: project_id.toString(),
        user_id: user_id.toString(),
      },
      customer_creation: 'always',
    };

    if (needs_shipping) {
      sessionConfig.shipping_address_collection = {
        allowed_countries: ['JP', 'US', 'GB', 'CA', 'AU'],
      };
    }

    // Create a checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    db.prepare('INSERT INTO purchases (user_id, project_id, amount, tier_description, stripe_session_id, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(user_id, project_id, amount, tier_description || '', session.id, 'pending');

    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/create-checkout-buyout', async (req, res) => {
  try {

    const { buyout_id, success_url, cancel_url, user_id } = req.body;
    const stripe = getStripe();
    console.log("HIT CREATE CHECKOUT BUYOUT", req.body);
    if (true || !stripe) { // temporarily disabled stripe for testing
      console.log("INSIDE MOCK BLOCK");
      // MOCK FOR TESTING WITHOUT STRIPE KEY
      const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyout_id) as any;
      if (buyout && buyout.status === 'completed' && buyout.winner_id) {
        if (buyout.item_type === 'idea') {
          db.prepare('UPDATE ideas SET author_id = ?, is_buyout = 0 WHERE id = ?').run(buyout.winner_id, buyout.item_id);
          db.prepare('UPDATE memos SET user_id = ? WHERE item_type = ? AND item_id = ? AND user_id = ?').run(buyout.winner_id, 'idea', buyout.item_id, buyout.creator_id);
        } else {
          
      db.prepare('UPDATE projects SET author_id = ?, is_buyout = 0 WHERE id = ?').run(buyout.winner_id, buyout.item_id);
      db.prepare('UPDATE memos SET user_id = ? WHERE project_id = ? AND user_id = ?').run(buyout.winner_id, buyout.item_id, buyout.creator_id);
      
      // Transfer ownership of all descendant IDEAs
      db.prepare(`
        WITH RECURSIVE idea_tree AS (
          SELECT id FROM ideas WHERE quoted_item_id = ? AND quoted_item_type = 'project'
          UNION ALL
          SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
        )
        UPDATE ideas SET author_id = ? WHERE id IN (SELECT id FROM idea_tree)
      `).run(buyout.item_id, buyout.winner_id);

        }
        db.prepare('UPDATE buyouts SET status = ? WHERE id = ?').run('paid', buyout.id);
        db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(buyout.creator_id, 'buyout_paid', buyout.winner_id, buyout.id, 'buyout');
        db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(buyout.winner_id, 'buyout_paid', buyout.creator_id, buyout.id, 'buyout');
      }
      return res.json({ url: success_url });
    }
    
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });

    const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyout_id) as any;
    if (!buyout) return res.status(404).json({ error: 'Buyout not found' });
    if (buyout.status !== 'completed' || buyout.winner_id !== user_id) {
      return res.status(400).json({ error: 'Not eligible to purchase this buyout' });
    }
    
    const author = db.prepare('SELECT stripe_account_id FROM users WHERE id = ?').get(buyout.creator_id) as any;
    // if (!author || !author.stripe_account_id) return res.status(400).json({ error: 'Author has not connected Stripe' });

    let title = 'Buyout';
    if (buyout.item_type === 'idea') {
      const item = db.prepare('SELECT title FROM ideas WHERE id = ?').get(buyout.item_id) as any;
      if (item) title = item.title;
    } else {
      const item = db.prepare('SELECT title FROM projects WHERE id = ?').get(buyout.item_id) as any;
      if (item) title = item.title;
    }

    const sessionConfig: any = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `Buyout: ${title}`,
            description: 'Ownership transfer',
          },
          unit_amount: buyout.winning_price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url,
      // temporarily disabled stripe connect for testing

      metadata: {
        buyout_id: buyout_id.toString(),
        user_id: user_id.toString(),
      },
      customer_creation: 'always',
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), (req, res) => {
  // Simple webhook handling (in a real app, verify signature)
  try {
    const event = req.body; // In dev, we can just trust it if signature verification isn't setup. Or parse json if it's already parsed.
    // express.raw won't work easily if body-parser json is already globally configured.
    // Assuming req.body is already parsed JSON.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const projectId = session.metadata?.project_id;
      const buyoutId = session.metadata?.buyout_id;
      const projectContractId = session.metadata?.project_contract_id;

      // 1. Project Contract Checkout Completed (項目55, 56, 57)
      if (projectContractId) {
        activateProjectContract(Number(projectContractId), session.payment_intent || session.id);
      }

      if (projectId && !projectContractId) {
        db.prepare('UPDATE projects SET funding_current = funding_current + ? WHERE id = ?').run(session.amount_total, projectId);
      }
      if (buyoutId) {
        // Trigger transfer
        const buyout = db.prepare('SELECT * FROM buyouts WHERE id = ?').get(buyoutId) as any;
        if (buyout && buyout.status === 'completed' && buyout.winner_id) {
          if (buyout.item_type === 'idea') {
            db.prepare('UPDATE ideas SET author_id = ?, is_buyout = 0 WHERE id = ?').run(buyout.winner_id, buyout.item_id);
            db.prepare('UPDATE memos SET user_id = ? WHERE item_type = ? AND item_id = ? AND user_id = ?').run(buyout.winner_id, 'idea', buyout.item_id, buyout.creator_id);
          } else {
            
      db.prepare('UPDATE projects SET author_id = ?, is_buyout = 0 WHERE id = ?').run(buyout.winner_id, buyout.item_id);
      db.prepare('UPDATE memos SET user_id = ? WHERE project_id = ? AND user_id = ?').run(buyout.winner_id, buyout.item_id, buyout.creator_id);
      
      // Transfer ownership of all descendant IDEAs
      db.prepare(`
        WITH RECURSIVE idea_tree AS (
          SELECT id FROM ideas WHERE quoted_item_id = ? AND quoted_item_type = 'project'
          UNION ALL
          SELECT i.id FROM ideas i JOIN idea_tree it ON i.quoted_item_id = it.id AND i.quoted_item_type = 'idea'
        )
        UPDATE ideas SET author_id = ? WHERE id IN (SELECT id FROM idea_tree)
      `).run(buyout.item_id, buyout.winner_id);

          }
          db.prepare('INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type) VALUES (?, ?, ?, ?, ?)').run(buyout.creator_id, 'buyout_paid', buyout.winner_id, buyout.id, 'buyout');
          io.to(`user:${buyout.creator_id}`).emit('notification');
        }
      }
    }
    res.json({received: true});
  } catch(e) {
    res.status(400).send(`Webhook Error: ${e}`);
  }
});


app.post('/api/items/:itemType/:itemId/stage_evaluation', (req, res) => {
  const { itemType, itemId } = req.params;
  let { user_id, stage } = req.body;
  
  if (!user_id || !stage) return res.status(400).json({ error: 'Missing parameters' });
  
  user_id = parseInt(user_id, 10);
  stage = parseInt(stage, 10);
  const parsedItemId = parseInt(itemId, 10);

  if (itemType !== 'idea' && itemType !== 'project') {
    return res.status(400).json({ error: 'Invalid item type' });
  }

  try {
    // Use INSERT OR REPLACE since there is a UNIQUE constraint on (item_id, item_type, user_id)
    // Wait, INSERT OR REPLACE replaces the row entirely (new ID, new created_at).
    // Let's just do an UPDATE, and if no rows affected, INSERT.
    const result = db.prepare('UPDATE stage_evaluations SET stage = ? WHERE item_type = ? AND item_id = ? AND user_id = ?').run(stage, itemType, parsedItemId, user_id);
    if (result.changes === 0) {
      db.prepare('INSERT INTO stage_evaluations (item_type, item_id, user_id, stage) VALUES (?, ?, ?, ?)').run(itemType, parsedItemId, user_id, stage);
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stage evaluation endpoint end

// Socket.io
io.on('connection', (socket) => {
  socket.on('join_user', (userId) => {
    socket.join(`user:${userId}`);
  });
  
  socket.on('join_idea', (ideaId) => {
    socket.join(`idea:${ideaId}`);
  });
  
  socket.on('leave_idea', (ideaId) => {
    socket.leave(`idea:${ideaId}`);
  });

  socket.on('join_project', (projectId) => {
    socket.join(`project:${projectId}`);
  });
  
  socket.on('leave_project', (projectId) => {
    socket.leave(`project:${projectId}`);
  });
  
  socket.on('join_direct_chat', (otherUserId) => {
    // Room name is sorted IDs to ensure both users join the same room
    const currentUserId = socket.data.userId; // We might need to set this on connection
    // For now, let's just use the ID passed from client if we don't have it in socket.data
    // But it's better to have it in socket.data
  });

  socket.on('send_message', (data) => {
    const { idea_id, project_id, recipient_id, user_id, content, type = 'text', metadata = null } = data;
    console.log('Socket: send_message received', { idea_id, project_id, recipient_id, user_id, content, type, metadata });
    
    if (!userExists(user_id)) {
      console.error('Socket error: User not found', user_id);
      return;
    }

    try {
      const info = db.prepare('INSERT INTO messages (idea_id, project_id, recipient_id, user_id, content, type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)').run(idea_id, project_id, recipient_id, user_id, content, type, metadata);
      const messageId = info.lastInsertRowid;

      // Automatically mark as read by sender
      db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').run(messageId, user_id);

      const message = db.prepare(`
        SELECT messages.id, messages.idea_id, messages.project_id, messages.recipient_id, messages.user_id, messages.content,
               messages.type, messages.metadata,
               strftime('%Y-%m-%dT%H:%M:%SZ', messages.created_at) as created_at,
               users.username, users.avatar,
               (SELECT COUNT(*) FROM message_reads WHERE message_id = messages.id) as read_count
        FROM messages
        JOIN users ON messages.user_id = users.id
        WHERE messages.id = ?
      `).get(messageId) as any;
      
      console.log('Socket: broadcasting new_message', message);
      if (idea_id) {
        io.to(`idea:${idea_id}`).emit('new_message', message);
      } else if (project_id) {
        io.to(`project:${project_id}`).emit('new_message', message);
      } else if (recipient_id) {
        // Direct message
        io.to(`user:${recipient_id}`).emit('new_message', message);
        io.to(`user:${user_id}`).emit('new_message', message);
      }
    } catch (e) {
      console.error('Socket error: Failed to insert message', e);
    }
  });

  socket.on('mark_as_read', (data) => {
    const { message_id, user_id, idea_id, project_id, recipient_id } = data;
    if (!message_id || !user_id) return;

    db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').run(message_id, user_id);
    
    const readCount = db.prepare('SELECT COUNT(*) as count FROM message_reads WHERE message_id = ?').get(message_id) as any;
    
    const payload = { message_id, user_id, read_count: readCount.count };
    if (idea_id) io.to(`idea:${idea_id}`).emit('message_read', payload);
    else if (project_id) io.to(`project:${project_id}`).emit('message_read', payload);
    else if (recipient_id) {
      io.to(`user:${recipient_id}`).emit('message_read', payload);
      io.to(`user:${user_id}`).emit('message_read', payload);
    }
  });

  socket.on('invite_contact', (data) => {
    const { idea_id, project_id, from_user_id, target_user_id } = data;
    const itemId = idea_id || project_id;
    const itemType = idea_id ? 'idea' : 'project';

    if (target_user_id && itemId) {
      const item = db.prepare(`SELECT title, author_id FROM ${itemType === 'idea' ? 'ideas' : 'projects'} WHERE id = ?`).get(itemId) as any;
      
      // Check if already mutual
      const existing = db.prepare(`SELECT id FROM idea_follows WHERE ${itemType === 'idea' ? 'idea_id' : 'project_id'} = ? AND follower_id = ?`).get(itemId, target_user_id) as any;
      
      if (!existing) {
        const followInfo = db.prepare(`INSERT INTO idea_follows (${itemType === 'idea' ? 'idea_id' : 'project_id'}, follower_id, is_mutual) VALUES (?, ?, 0)`).run(itemId, target_user_id);
        const follow_id = followInfo.lastInsertRowid;
        
        db.prepare(`
          INSERT INTO notifications (user_id, type, from_user_id, item_id, item_type, follow_id)
          VALUES (?, 'invitation', ?, ?, ?, ?)
        `).run(target_user_id, from_user_id, itemId, itemType, follow_id);
        
        io.to(`user:${target_user_id}`).emit('notification', { type: 'invitation', item_id: itemId, item_type: itemType, idea_title: item.title });
      }
    }
  });
});




// =========================================================================
// 料金・収益モデル・プラン機能・AI利用制限・Stripe Subscription (項目1〜38)
// =========================================================================

// 項目30: ハードコードを排除した設定値管理
const PRICING_CONFIG = {
  FREE_AI_VISION_MONTHLY_LIMIT: Number(process.env.FREE_AI_VISION_MONTHLY_LIMIT || 5),
  PRO_MONTHLY_FEE: Number(process.env.PRO_MONTHLY_FEE || 980),
  ORG_LIGHT_MONTHLY_FEE: Number(process.env.ORG_LIGHT_MONTHLY_FEE || 3000),
  ORG_STANDARD_MONTHLY_FEE: Number(process.env.ORG_STANDARD_MONTHLY_FEE || 9800),
  ORG_ENTERPRISE_MONTHLY_FEE: Number(process.env.ORG_ENTERPRISE_MONTHLY_FEE || 29800),
  GOV_BASIC_MONTHLY_FEE: Number(process.env.GOV_BASIC_MONTHLY_FEE || 0),
  GOV_STANDARD_MONTHLY_FEE: Number(process.env.GOV_STANDARD_MONTHLY_FEE || 19800),
  GOV_ENTERPRISE_MONTHLY_FEE: process.env.GOV_ENTERPRISE_MONTHLY_FEE || 'custom',
  PROJECT_ORG_FEE_RATE: Number(process.env.PROJECT_ORG_FEE_RATE || 0.05), // 組織側5%成功報酬
  PROJECT_IND_FEE_RATE: Number(process.env.PROJECT_IND_FEE_RATE || 0.00), // 個人側0%
  STORE_FEE_RATE: Number(process.env.STORE_FEE_RATE || 0.10),             // Store 10%
  BUYOUT_FEE_RATE: Number(process.env.BUYOUT_FEE_RATE || 0.05),           // Buyout 5%
};

// 1. 全設定値をフロントエンドに提供するAPI
app.get(['/api/platform/pricing-config', '/api/pricing/config', '/api/pricing-config'], (req, res) => {
  res.json({
    freeAiVisionMonthlyLimit: PRICING_CONFIG.FREE_AI_VISION_MONTHLY_LIMIT,
    proMonthlyFee: PRICING_CONFIG.PRO_MONTHLY_FEE,
    orgLightMonthlyFee: PRICING_CONFIG.ORG_LIGHT_MONTHLY_FEE,
    orgStandardMonthlyFee: PRICING_CONFIG.ORG_STANDARD_MONTHLY_FEE,
    orgEnterpriseMonthlyFee: PRICING_CONFIG.ORG_ENTERPRISE_MONTHLY_FEE,
    govBasicMonthlyFee: PRICING_CONFIG.GOV_BASIC_MONTHLY_FEE,
    govStandardMonthlyFee: PRICING_CONFIG.GOV_STANDARD_MONTHLY_FEE,
    govEnterpriseMonthlyFee: PRICING_CONFIG.GOV_ENTERPRISE_MONTHLY_FEE,
    projectOrgFeeRate: PRICING_CONFIG.PROJECT_ORG_FEE_RATE,
    projectIndFeeRate: PRICING_CONFIG.PROJECT_IND_FEE_RATE,
    storeFeeRate: PRICING_CONFIG.STORE_FEE_RATE,
    buyoutFeeRate: PRICING_CONFIG.BUYOUT_FEE_RATE,
  });
});

// Helper: ユーザーの現在の有効プランを取得
function getUserEffectivePlan(userId: number): 'free' | 'pro' | 'light' | 'standard' | 'enterprise' {
  try {
    const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as any;
    const sub = db.prepare('SELECT plan, status FROM user_subscriptions WHERE user_id = ?').get(userId) as any;
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
      return sub.plan;
    }
    return user?.plan || 'free';
  } catch (e) {
    return 'free';
  }
}

// 2. AI利用状況・権限チェックAPI (項目2, 4, 5)
app.get('/api/ai/usage-status', (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.query.user_id);
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const plan = getUserEffectivePlan(userId);
    const isPro = plan === 'pro' || plan === 'standard' || plan === 'enterprise';

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usage = db.prepare(`
      SELECT usage_count FROM ai_usages
      WHERE user_id = ? AND feature = 'ai_vision' AND period_start = ?
    `).get(userId, currentPeriod) as any;

    const count = usage ? usage.usage_count : 0;
    const limit = isPro ? 999999 : PRICING_CONFIG.FREE_AI_VISION_MONTHLY_LIMIT;
    const remaining = isPro ? 999999 : Math.max(0, limit - count);

    res.json({
      feature: 'ai_vision',
      plan,
      usage_count: count,
      monthly_limit: limit,
      remaining,
      is_pro: isPro,
      can_generate_image: isPro, // 項目5: AI画像生成はPro以上
      can_use_ai_vision: isPro || remaining > 0 // 項目2: Freeは月5回まで
    });
  } catch (e: any) {
    console.error('Error fetching AI usage:', e);
    res.status(500).json({ error: 'Failed to fetch AI usage' });
  }
});

// 3. AI利用カウント加算API (項目2)
app.post('/api/ai/record-usage', (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.body.user_id);
    const { feature = 'ai_vision' } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const plan = getUserEffectivePlan(userId);
    const isPro = plan === 'pro' || plan === 'standard' || plan === 'enterprise';

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Freeユーザーで上限超過の場合はエラー
    const current = db.prepare(`
      SELECT usage_count FROM ai_usages
      WHERE user_id = ? AND feature = ? AND period_start = ?
    `).get(userId, feature, currentPeriod) as any;

    const currentCount = current ? current.usage_count : 0;

    if (!isPro && feature === 'ai_vision' && currentCount >= PRICING_CONFIG.FREE_AI_VISION_MONTHLY_LIMIT) {
      return res.status(403).json({
        error: '今月のAI Vision作成回数を使い切りました。',
        limitReached: true,
        remaining: 0,
        usage_count: currentCount,
        monthly_limit: PRICING_CONFIG.FREE_AI_VISION_MONTHLY_LIMIT
      });
    }

    if (!isPro && feature === 'ai_image') {
      return res.status(403).json({
        error: 'AI画像生成はProで利用できます。',
        requiresPro: true
      });
    }

    db.prepare(`
      INSERT INTO ai_usages (user_id, feature, usage_count, period_start, updated_at)
      VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, feature, period_start)
      DO UPDATE SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
    `).run(userId, feature, currentPeriod);

    const updated = db.prepare(`
      SELECT usage_count FROM ai_usages
      WHERE user_id = ? AND feature = ? AND period_start = ?
    `).get(userId, feature, currentPeriod) as any;

    const limit = isPro ? 999999 : PRICING_CONFIG.FREE_AI_VISION_MONTHLY_LIMIT;
    const remaining = isPro ? 999999 : Math.max(0, limit - updated.usage_count);

    res.json({
      success: true,
      usage_count: updated.usage_count,
      remaining,
      monthly_limit: limit
    });
  } catch (e: any) {
    console.error('Error recording AI usage:', e);
    res.status(500).json({ error: 'Failed to record AI usage' });
  }
});

// 4. Stripe Subscription Checkout作成API (項目6, 7, 10, 26)
app.post(['/api/stripe/create-subscription-checkout', '/api/subscriptions/create-checkout', '/api/subscriptions/checkout'], async (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.body.user_id);
    const { target_plan = 'pro', return_path = '/' } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const user = db.prepare('SELECT id, email, username, plan, account_type, org_plan, stripe_customer_id, company_name FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    let amount = PRICING_CONFIG.PRO_MONTHLY_FEE;
    let planName = 'E-hub Pro プラン (月額)';
    let planDescription = 'AI Vision拡張、AI画像生成、高度AI分析、非公開Vision等のPro全機能';

    const isGov = user?.account_type === 'municipality';
    if (isGov) {
      if (target_plan === 'basic' || target_plan === 'light' || target_plan === 'free') {
        amount = PRICING_CONFIG.GOV_BASIC_MONTHLY_FEE;
        planName = 'E-hub 自治体 Basic プラン (月額)';
        planDescription = '地域課題・公開プロジェクトを運営する基本プラン';
      } else if (target_plan === 'standard') {
        amount = PRICING_CONFIG.GOV_STANDARD_MONTHLY_FEE;
        planName = 'E-hub 自治体 Standard プラン (月額)';
        planDescription = '地域創生・官民連携向け。非公開Project・AI人材スカウト・チーム組成';
      } else if (target_plan === 'enterprise') {
        amount = typeof PRICING_CONFIG.GOV_ENTERPRISE_MONTHLY_FEE === 'number' ? PRICING_CONFIG.GOV_ENTERPRISE_MONTHLY_FEE : 0;
        planName = 'E-hub 自治体 Enterprise プラン (個別見積)';
        planDescription = '広域自治体・包括連携協定・専用AI・LGWAN/SSO対応';
      }
    } else {
      if (target_plan === 'light') {
        amount = PRICING_CONFIG.ORG_LIGHT_MONTHLY_FEE;
        planName = 'E-hub 法人 Light プラン (月額)';
        planDescription = '法人Projectを運営する基本プラン';
      } else if (target_plan === 'standard') {
        amount = PRICING_CONFIG.ORG_STANDARD_MONTHLY_FEE;
        planName = 'E-hub 法人 Standard プラン (月額)';
        planDescription = '成長企業向け。非公開Project・AI候補者推薦・チーム編成・スカウト';
      } else if (target_plan === 'enterprise') {
        amount = PRICING_CONFIG.ORG_ENTERPRISE_MONTHLY_FEE;
        planName = 'E-hub 法人 Enterprise プラン (月額)';
        planDescription = '大規模組織向け。高度AI、SSO、API、権限管理、監査、CS';
      }
    }

    const stripe = getStripe();

    // Stripe未設定時 or テストシミュレーションモード (TEST MODE)
    if (!stripe || amount === 0) {
      console.log(`[TEST/FREE UPGRADE] Upgrading user ${userId} to ${target_plan} directly`);
      if (['basic', 'light', 'standard', 'enterprise'].includes(target_plan)) {
        db.prepare('UPDATE users SET plan = ?, org_plan = ? WHERE id = ?').run(target_plan, target_plan, userId);
      } else {
        db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(target_plan, userId);
      }
      db.prepare(`
        INSERT INTO user_subscriptions (user_id, plan, status, current_period_start, current_period_end)
        VALUES (?, ?, 'active', CURRENT_TIMESTAMP, datetime('now', '+1 month'))
        ON CONFLICT(user_id) DO UPDATE SET
          plan = excluded.plan,
          status = 'active',
          current_period_end = datetime('now', '+1 month'),
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, target_plan);

      return res.json({
        mock: true,
        success: true,
        plan: target_plan,
        message: `TEST MODE: ${planName} へのアップグレードが完了しました。`
      });
    }

    // Stripe Customerの取得または作成（既存のStripe Customer IDを優先使用し重複作成を防ぐ）
    let customerId = user?.stripe_customer_id || '';
    if (!customerId) {
      const existingSub = db.prepare('SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = ?').get(userId) as any;
      if (existingSub?.stripe_customer_id) {
        customerId = existingSub.stripe_customer_id;
      }
    }

    if (customerId) {
      // ユーザー情報・企業名変更時のStripe Customer同期（同一Customer IDを完全保持）
      try {
        await stripe.customers.update(customerId, {
          name: user.company_name || user.username || `User #${userId}`,
          email: user.email || `user_${userId}@ehub.example.com`,
          metadata: { user_id: userId.toString(), account_type: user.account_type || 'corporate' }
        });
      } catch (e) {
        console.warn('Failed to update existing Stripe customer metadata:', e);
      }
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, userId);
    } else {
      const customer = await stripe.customers.create({
        email: user.email || `user_${userId}@ehub.example.com`,
        name: user.company_name || user.username || `User #${userId}`,
        metadata: { user_id: userId.toString(), account_type: user.account_type || 'corporate' }
      });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, userId);
      db.prepare(`
        INSERT INTO user_subscriptions (user_id, plan, stripe_customer_id, status)
        VALUES (?, 'free', ?, 'active')
        ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id
      `).run(userId, customerId);
    }

    const origin = req.headers.origin || 'http://localhost:3000';
    const cleanReturnPath = return_path.startsWith('/') ? return_path : '/' + return_path;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: planName,
              description: planDescription,
            },
            unit_amount: amount,
            recurring: { interval: 'month' }
          },
          quantity: 1,
        }
      ],
      mode: 'subscription',
      metadata: {
        user_id: userId.toString(),
        target_plan: target_plan,
        type: 'user_subscription'
      },
      success_url: `${origin}${cleanReturnPath}?upgrade_success=true&plan=${target_plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cleanReturnPath}?upgrade_cancelled=true`
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (e: any) {
    console.error('Error creating subscription checkout:', e);
    res.status(500).json({ error: e.message || 'Failed to create subscription checkout' });
  }
});

// 5. Stripe Customer Portal（解約・請求情報管理） (項目9)
app.post(['/api/stripe/customer-portal', '/api/subscriptions/customer-portal', '/api/stripe/portal'], async (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.body.user_id);
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const sub = db.prepare('SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = ?').get(userId) as any;
    const stripe = getStripe();

    if (!stripe || !sub?.stripe_customer_id) {
      // Test mode / Mock fallback: 直接Freeにダウングレード
      db.prepare('UPDATE users SET plan = "free" WHERE id = ?').run(userId);
      db.prepare('UPDATE user_subscriptions SET plan = "free", status = "canceled" WHERE user_id = ?').run(userId);
      return res.json({
        mock: true,
        success: true,
        message: 'TEST MODE: プランをFreeへ変更しました（作成済みのデータはすべて保持されます）。'
      });
    }

    const origin = req.headers.origin || 'http://localhost:3000';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/plans`
    });

    res.json({ url: portalSession.url });
  } catch (e: any) {
    console.error('Error creating customer portal session:', e);
    res.status(500).json({ error: e.message || 'Failed to create portal session' });
  }
});

// 6. Stripe Webhook処理 (項目8, 28: 署名検証・サブスクリプション同期・冪等性)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  let event: any;

  if (stripe && webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // 開発テストモード (署名なしの直接JSONパース)
    try {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      return res.status(400).send('Invalid payload');
    }
  }

  try {
    const eventType = event.type;
    const dataObject = event.data?.object;

    console.log(`[Stripe Webhook] Received event: ${eventType}`);

    switch (eventType) {
      case 'checkout.session.completed': {
        const session = dataObject;
        const metadata = session.metadata || {};

        if (metadata.type === 'user_subscription') {
          const userId = Number(metadata.user_id);
          const targetPlan = metadata.target_plan || 'pro';
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (userId) {
            db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(targetPlan, userId);
            db.prepare(`
              INSERT INTO user_subscriptions (user_id, plan, stripe_customer_id, stripe_subscription_id, status, updated_at)
              VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
              ON CONFLICT(user_id) DO UPDATE SET
                plan = excluded.plan,
                stripe_customer_id = excluded.stripe_customer_id,
                stripe_subscription_id = excluded.stripe_subscription_id,
                status = 'active',
                updated_at = CURRENT_TIMESTAMP
            `).run(userId, targetPlan, customerId, subscriptionId);

            console.log(`[Webhook] User ${userId} upgraded to ${targetPlan}`);
          }
        } else if (metadata.type === 'project_contract') {
          const contractId = Number(metadata.project_contract_id);
          if (contractId) {
            activateProjectContract(contractId, session.payment_intent || session.id);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = dataObject;
        const status = subscription.status; // 'active', 'past_due', 'canceled', etc.
        const customerId = subscription.customer;

        const subRecord = db.prepare('SELECT user_id, plan FROM user_subscriptions WHERE stripe_customer_id = ?').get(customerId) as any;
        if (subRecord) {
          const isCancelAtPeriodEnd = !!subscription.cancel_at_period_end;
          db.prepare(`
            UPDATE user_subscriptions
            SET status = ?,
                cancel_at_period_end = ?,
                current_period_end = datetime(?, 'unixepoch'),
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
          `).run(status, isCancelAtPeriodEnd ? 1 : 0, subscription.current_period_end, customerId);

          if (status === 'canceled' || status === 'unpaid') {
            db.prepare('UPDATE users SET plan = "free" WHERE id = ?').run(subRecord.user_id);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = dataObject;
        const customerId = subscription.customer;
        const subRecord = db.prepare('SELECT user_id FROM user_subscriptions WHERE stripe_customer_id = ?').get(customerId) as any;
        if (subRecord) {
          db.prepare('UPDATE users SET plan = "free" WHERE id = ?').run(subRecord.user_id);
          db.prepare(`
            UPDATE user_subscriptions
            SET plan = 'free', status = 'canceled', updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
          `).run(customerId);
          console.log(`[Webhook] User ${subRecord.user_id} subscription ended -> returned to free`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Error handling webhook event:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// 7. 直接プラン更新（テスト・デモ用即時反映対応）
app.post(['/api/users/:id/update-plan', '/api/users/:id/plan', '/api/users/upgrade-plan', '/api/users/update-plan'], (req, res) => {
  try {
    const targetUserId = Number(req.params.id || req.headers['x-user-id'] || req.body.user_id);
    const { plan = 'pro', billing_cycle = 'monthly', payment_method = 'credit_card' } = req.body;

    if (!targetUserId) return res.status(400).json({ error: 'User ID required' });

    if (['basic', 'light', 'standard', 'enterprise'].includes(plan)) {
      db.prepare('UPDATE users SET plan = ?, org_plan = ? WHERE id = ?').run(plan, plan, targetUserId);
    } else {
      db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, targetUserId);
    }

    db.prepare(`
      INSERT INTO user_subscriptions (user_id, plan, billing_cycle, payment_method_type, status, updated_at)
      VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET 
        plan = excluded.plan, 
        billing_cycle = excluded.billing_cycle,
        payment_method_type = excluded.payment_method_type,
        status = 'active', 
        updated_at = CURRENT_TIMESTAMP
    `).run(targetUserId, plan, billing_cycle, payment_method);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    res.json({ success: true, plan, user: updatedUser });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 自治体・法人向け契約・請求書払い・見積書発行リクエストAPI
app.post(['/api/contracts/requests', '/api/billing/contracts/request'], (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.body.user_id);
    const {
      target_plan = 'standard',
      billing_cycle = 'yearly', // 'monthly' | 'yearly'
      payment_method = 'invoice', // 'invoice' (請求書払い) | 'bank_transfer' (銀行振込) | 'credit_card'
      request_type = 'invoice_payment', // 'quote' | 'invoice_payment' | 'annual_contract' | 'contract_consultation'
      org_name = '',
      department = '',
      contact_name = '',
      email = '',
      phone = '',
      custom_notes = ''
    } = req.body;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const accountType = user.account_type || 'municipality';

    const insertResult = db.prepare(`
      INSERT INTO contract_requests (
        user_id, account_type, target_plan, billing_cycle, payment_method, 
        request_type, org_name, department, contact_name, email, phone, custom_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      userId, accountType, target_plan, billing_cycle, payment_method,
      request_type, org_name || user.company_name || user.username,
      department, contact_name || user.username, email || user.email,
      phone, custom_notes
    );

    // 金額計算
    let baseMonthlyPrice = 0;
    if (accountType === 'municipality') {
      if (target_plan === 'standard') baseMonthlyPrice = PRICING_CONFIG.GOV_STANDARD_MONTHLY_FEE;
      else if (target_plan === 'basic') baseMonthlyPrice = PRICING_CONFIG.GOV_BASIC_MONTHLY_FEE;
      else baseMonthlyPrice = typeof PRICING_CONFIG.GOV_ENTERPRISE_MONTHLY_FEE === 'number' ? PRICING_CONFIG.GOV_ENTERPRISE_MONTHLY_FEE : 50000;
    } else {
      if (target_plan === 'light') baseMonthlyPrice = PRICING_CONFIG.ORG_LIGHT_MONTHLY_FEE;
      else if (target_plan === 'standard') baseMonthlyPrice = PRICING_CONFIG.ORG_STANDARD_MONTHLY_FEE;
      else baseMonthlyPrice = PRICING_CONFIG.ORG_ENTERPRISE_MONTHLY_FEE;
    }

    const multiplier = billing_cycle === 'yearly' ? 12 : 1;
    // 年間契約なら10%割引適用
    const discountRate = billing_cycle === 'yearly' ? 0.9 : 1.0;
    const netAmount = Math.round(baseMonthlyPrice * multiplier * discountRate);
    const taxAmount = Math.round(netAmount * 0.1);
    const totalAmount = netAmount + taxAmount;

    // 見積書または請求書レコードの自動生成
    const docType = request_type === 'quote' ? 'quote' : 'invoice';
    const invoicePrefix = docType === 'quote' ? 'QUO' : 'INV';
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = `${invoicePrefix}-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const issueDate = new Date().toISOString().slice(0, 10);
    // 支払期日（翌月末または請求書発行日より30日後）
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + 30);
    const dueDate = dueDateObj.toISOString().slice(0, 10);

    const docTitle = `${accountType === 'municipality' ? '自治体' : '法人'} ${target_plan.toUpperCase()} プラン（${billing_cycle === 'yearly' ? '年間一括契約' : '月額契約'}）ご利用料`;

    db.prepare(`
      INSERT INTO billing_invoices (
        user_id, invoice_number, document_type, title, target_plan, 
        billing_cycle, payment_method, amount, tax_amount, total_amount, 
        status, issue_date, due_date, recipient_name, recipient_department, recipient_email, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?)
    `).run(
      userId, invoiceNumber, docType, docTitle, target_plan,
      billing_cycle, payment_method, netAmount, taxAmount, totalAmount,
      issueDate, dueDate, org_name || user.company_name || user.username,
      department, email || user.email, custom_notes
    );

    // 請求書払い（Invoice / 銀行振込）で即時有効化リクエストの場合
    if (request_type === 'invoice_payment' || request_type === 'annual_contract') {
      db.prepare('UPDATE users SET plan = ?, org_plan = ? WHERE id = ?').run(target_plan, target_plan, userId);
      db.prepare(`
        INSERT INTO user_subscriptions (user_id, plan, billing_cycle, payment_method_type, contract_status, status, current_period_end, updated_at)
        VALUES (?, ?, ?, ?, 'invoiced', 'active', datetime('now', ?), CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          plan = excluded.plan,
          billing_cycle = excluded.billing_cycle,
          payment_method_type = excluded.payment_method_type,
          contract_status = 'invoiced',
          status = 'active',
          current_period_end = datetime('now', ?),
          updated_at = CURRENT_TIMESTAMP
      `).run(
        userId, target_plan, billing_cycle, payment_method,
        billing_cycle === 'yearly' ? '+1 year' : '+1 month',
        billing_cycle === 'yearly' ? '+1 year' : '+1 month'
      );
    }

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    res.json({
      success: true,
      requestId: insertResult.lastInsertRowid,
      invoiceNumber,
      documentType: docType,
      user: updatedUser,
      message: request_type === 'quote' 
        ? '見積書を発行いたしました。ダウンロード・印刷してご活用ください。' 
        : '請求書払いでのご契約・お申し込みを受け付けました。ご指定のメールアドレスへ請求書（インボイス対応）をお送りいたします。'
    });
  } catch (e: any) {
    console.error('Error creating contract request:', e);
    res.status(500).json({ error: e.message || 'Failed to create contract request' });
  }
});

// 自治体・法人向け 契約リクエスト一覧取得
app.get(['/api/contracts/requests', '/api/billing/contracts/requests'], (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.query.user_id);
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const requests = db.prepare('SELECT * FROM contract_requests WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    res.json(requests);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 請求書・見積書一覧取得
app.get(['/api/billing/invoices', '/api/invoices'], (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.query.user_id);
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const invoices = db.prepare('SELECT * FROM billing_invoices WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    res.json(invoices);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 見積書即時生成・プレビューデータAPI
app.post('/api/billing/invoices/generate-quote', (req, res) => {
  try {
    const userId = Number(req.headers['x-user-id'] || req.body.user_id);
    const { target_plan = 'standard', billing_cycle = 'yearly', org_name = '', department = '', contact_name = '' } = req.body;

    const user = userId ? db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any : null;
    const accountType = user?.account_type || req.body.account_type || 'municipality';

    let baseMonthlyPrice = 0;
    if (accountType === 'municipality') {
      if (target_plan === 'standard') baseMonthlyPrice = PRICING_CONFIG.GOV_STANDARD_MONTHLY_FEE;
      else if (target_plan === 'basic') baseMonthlyPrice = PRICING_CONFIG.GOV_BASIC_MONTHLY_FEE;
      else baseMonthlyPrice = typeof PRICING_CONFIG.GOV_ENTERPRISE_MONTHLY_FEE === 'number' ? PRICING_CONFIG.GOV_ENTERPRISE_MONTHLY_FEE : 50000;
    } else {
      if (target_plan === 'light') baseMonthlyPrice = PRICING_CONFIG.ORG_LIGHT_MONTHLY_FEE;
      else if (target_plan === 'standard') baseMonthlyPrice = PRICING_CONFIG.ORG_STANDARD_MONTHLY_FEE;
      else baseMonthlyPrice = PRICING_CONFIG.ORG_ENTERPRISE_MONTHLY_FEE;
    }

    const multiplier = billing_cycle === 'yearly' ? 12 : 1;
    const discountRate = billing_cycle === 'yearly' ? 0.9 : 1.0;
    const netAmount = Math.round(baseMonthlyPrice * multiplier * discountRate);
    const taxAmount = Math.round(netAmount * 0.1);
    const totalAmount = netAmount + taxAmount;

    const quoteNumber = `QUO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const issueDate = new Date().toISOString().slice(0, 10);
    const validUntilObj = new Date();
    validUntilObj.setDate(validUntilObj.getDate() + 60);
    const validUntil = validUntilObj.toISOString().slice(0, 10);

    const quoteData = {
      quoteNumber,
      issueDate,
      validUntil,
      recipient: {
        orgName: org_name || user?.company_name || (accountType === 'municipality' ? '〇〇市役所' : '〇〇株式会社'),
        department: department || '企画調整課 / 官民共創推進室',
        contactName: contact_name || user?.username || 'ご担当者様'
      },
      issuer: {
        name: 'E-hub 運営事務局 / 株式会社E-hub',
        invoiceRegistrationNumber: 'T1234567890123',
        address: '東京都千代田区大手町1-1-1 共創イノベーションビル',
        email: 'billing@ehub.example.com',
        phone: '03-1234-5678'
      },
      items: [
        {
          name: `E-hub ${accountType === 'municipality' ? '自治体' : '法人'} ${target_plan.toUpperCase()} プラン（${billing_cycle === 'yearly' ? '年間契約 10%割引適用' : '月額契約'}）`,
          quantity: 1,
          unitPrice: netAmount,
          amount: netAmount,
          taxRate: '10%'
        }
      ],
      netAmount,
      taxAmount,
      totalAmount,
      billingCycle: billing_cycle,
      paymentTerms: '請求書受領後 翌月末銀行振込（公金支出・官公庁後払い対応）',
      bankInfo: {
        bankName: 'みずほ銀行',
        branchName: '東京中央支店 (001)',
        accountType: '普通',
        accountNumber: '1234567',
        accountHolder: 'カ）イーハブ'
      }
    };

    res.json(quoteData);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put(['/api/users/:id/plan', '/api/users/:id/update-plan'], (req, res) => {
  try {
    const targetUserId = Number(req.params.id || req.headers['x-user-id'] || req.body.user_id);
    const { plan = 'pro' } = req.body;

    if (!targetUserId) return res.status(400).json({ error: 'User ID required' });

    if (['light', 'standard', 'enterprise'].includes(plan)) {
      db.prepare('UPDATE users SET plan = ?, org_plan = ? WHERE id = ?').run(plan, plan, targetUserId);
    } else {
      db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, targetUserId);
    }

    db.prepare(`
      INSERT INTO user_subscriptions (user_id, plan, status, updated_at)
      VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, status = 'active', updated_at = CURRENT_TIMESTAMP
    `).run(targetUserId, plan);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    res.json({ success: true, plan, user: updatedUser });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Unhandled API routes fallback
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Global error handler:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});


async function startServer() {
  await bootDb();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: projectRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();


