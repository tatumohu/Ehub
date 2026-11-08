const fs = require('fs').promises;
const path = require('path');

async function walk(dir) {
    const files = await fs.readdir(dir, { withFileTypes: true });
    const paths = await Promise.all(files.map(async file => {
        const res = path.resolve(dir, file.name);
        return file.isDirectory() ? walk(res) : [res];
    }));
    return paths.flat();
}

async function stripMotion() {
    const srcDir = path.resolve(process.cwd(), 'src');
    const files = await walk(srcDir);

    for (const file of files) {
        if (!file.endsWith('.tsx') && !file.endsWith('.ts') && !file.endsWith('.js') && !file.endsWith('.jsx')) continue;
        
        let content = await fs.readFile(file, 'utf-8');
        let changed = false;

        // Strip imports - case insensitive for framer-motion and motion
        if (/import.*framer-motion.*/gi.test(content)) {
            content = content.replace(/^import.*framer-motion.*$/gim, '');
            changed = true;
        }
        if (/import.*['"]motion['"].*/gi.test(content)) {
             content = content.replace(/^import.*['"]motion['"].*$/gim, '');
             changed = true;
        }

        // Strip <motion.x ...> and </motion.x>
        if (/<motion\.(\w+)/g.test(content)) {
            content = content.replace(/<motion\.(\w+)/g, '<$1');
            content = content.replace(/<\/motion\.(\w+)>/g, '</$1>');
            changed = true;
        }

        // Strip <AnimatePresence ...> and </AnimatePresence>
        if (content.includes('AnimatePresence')) {
            content = content.replace(/<AnimatePresence[^>]*>/g, '');
            content = content.replace(/<\/AnimatePresence>/g, '');
            // Also remove from destructuring imports
            content = content.replace(/,\s*AnimatePresence/g, '');
            content = content.replace(/AnimatePresence,\s*/g, '');
            content = content.replace(/\{\s*AnimatePresence\s*\}/g, '{}');
            changed = true;
        }

        // Strip framer-motion specific props - very aggressive regex
        const props = ['initial', 'animate', 'exit', 'variants', 'layoutId', 'transition', 'whileHover', 'whileTap', 'whileDrag', 'viewport', 'layout'];
        for (const prop of props) {
            // Match prop={...} or prop="..." including multiline
            const regex = new RegExp(`\\s${prop}={(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*}\\s*`, 'g');
            if (regex.test(content)) {
                content = content.replace(regex, ' ');
                changed = true;
            }
            const regexStr = new RegExp(`\\s${prop}="[^"]*"\\s*`, 'g');
             if (regexStr.test(content)) {
                content = content.replace(regexStr, ' ');
                changed = true;
            }
        }

        if (changed) {
            console.log(`Stripped motion from ${file}`);
            await fs.writeFile(file, content);
        }
    }
}

stripMotion().catch(console.error);
