import mongoose, { Schema, Document } from 'mongoose';

export interface IAIConversation extends Document {
  userId: string;
  title: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  context: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AIConversationSchema = new Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, default: 'New conversation' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  context: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export const AIConversation = mongoose.model<IAIConversation>('AIConversation', AIConversationSchema);
