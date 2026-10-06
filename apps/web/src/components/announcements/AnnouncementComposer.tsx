import { useState } from 'react';
import { Modal } from '../ui/Modal';
import type {
  AnnouncementAudienceType,
  AnnouncementCategory,
  AnnouncementPriority,
  Building,
  CreateAnnouncementInput,
  Department,
  RoleName,
} from '../../types';

const CATEGORIES: AnnouncementCategory[] = [
  'GENERAL',
  'ACADEMIC',
  'EXAMINATION',
  'EVENT',
  'MAINTENANCE',
  'EMERGENCY',
  'TRANSPORT',
  'FACILITY',
  'SECURITY',
  'OTHER',
];

const PRIORITIES: AnnouncementPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

interface AnnouncementComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAnnouncementInput) => void | Promise<void>;
  departments: Department[];
  buildings: Building[];
  allowedRoles: RoleName[];
  isSubmitting?: boolean;
}

export function AnnouncementComposer({
  isOpen,
  onClose,
  onSubmit,
  departments,
  buildings,
  allowedRoles,
  isSubmitting,
}: AnnouncementComposerProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('GENERAL');
  const [priority, setPriority] = useState<AnnouncementPriority>('NORMAL');
  const [audienceType, setAudienceType] = useState<AnnouncementAudienceType>('ALL');
  const [targetRole, setTargetRole] = useState<RoleName>('STUDENT');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetBuildingId, setTargetBuildingId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const reset = () => {
    setTitle('');
    setContent('');
    setCategory('GENERAL');
    setPriority('NORMAL');
    setAudienceType('ALL');
    setScheduledAt('');
    setExpiresAt('');
  };

  const handleSubmit = () => {
    const payload: CreateAnnouncementInput = {
      title,
      content,
      category,
      priority,
      audienceType,
      scheduledAt: scheduledAt || undefined,
      expiresAt: expiresAt || undefined,
    };
    if (audienceType === 'ROLE') payload.targetRole = targetRole;
    if (audienceType === 'DEPARTMENT') payload.targetDepartmentId = targetDepartmentId;
    if (audienceType === 'BUILDING') payload.targetBuildingId = targetBuildingId;
    void onSubmit(payload);
    reset();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Announcement">
      <div className="space-y-4 text-sm">
        <div>
          <label className="block text-slate-400 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Audience</label>
          <select
            value={audienceType}
            onChange={(e) => setAudienceType(e.target.value as AnnouncementAudienceType)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
          >
            <option value="ALL">Everyone</option>
            <option value="ROLE">Role</option>
            <option value="DEPARTMENT">Department</option>
            <option value="BUILDING">Building</option>
          </select>
        </div>
        {audienceType === 'ROLE' && (
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value as RoleName)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
        {audienceType === 'DEPARTMENT' && (
          <select
            value={targetDepartmentId}
            onChange={(e) => setTargetDepartmentId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        {audienceType === 'BUILDING' && (
          <select
            value={targetBuildingId}
            onChange={(e) => setTargetBuildingId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
          >
            <option value="">Select building</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 mb-1">Schedule (optional)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Expires (optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button
            disabled={!title.trim() || !content.trim() || isSubmitting}
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
          >
            Save draft
          </button>
        </div>
      </div>
    </Modal>
  );
}
