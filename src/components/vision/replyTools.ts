export type VisionReply={id:number;content:string;user_id:number;parent_id:number|null;author_name:string;author_avatar?:string;created_at:string;edited_at?:string|null;deleted_at?:string|null};
export const replyCount=(replies:VisionReply[])=>replies.filter(r=>!r.deleted_at).length;
