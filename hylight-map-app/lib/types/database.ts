import { Database } from './database.types';

export type Photo = Database['public']['Tables']['photos']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];

export type PhotoInsert = Database['public']['Tables']['photos']['Insert'];
export type CommentInsert = Database['public']['Tables']['comments']['Insert'];
