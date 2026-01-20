import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Globe, Lock, UserPlus, Trash2, Link2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Trip, TripVisibility } from '../types';
import { tripShareService } from '../services/TripShareService';

interface ShareTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    trip: Trip;
    onVisibilityChange?: (visibility: TripVisibility) => void;
}

export default function ShareTripModal({ isOpen, onClose, trip, onVisibilityChange }: ShareTripModalProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const shareUrl = tripShareService.getShareUrl(trip.serverTripId || trip.id);
    const isPublic = trip.visibility === 'public';

    useEffect(() => {
        if (isOpen && trip.serverTripId) {
            // Load allowed users when modal opens
            loadAllowedUsers();
        }
    }, [isOpen, trip.serverTripId]);

    const loadAllowedUsers = async () => {
        if (!trip.serverTripId) return;
        try {
            const shared = await tripShareService.getTrip(trip.serverTripId);
            setAllowedUsers(shared.allowedUsers || []);
        } catch (e) {
            console.error('Failed to load allowed users:', e);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    const handleAddUser = async () => {
        if (!newEmail.trim() || !trip.serverTripId) return;

        const email = newEmail.trim().toLowerCase();
        if (allowedUsers.includes(email)) {
            setError('該用戶已在列表中');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const newList = [...allowedUsers, email];
            await tripShareService.updatePermissions(trip.serverTripId, newList);
            setAllowedUsers(newList);
            setNewEmail('');
        } catch (e: any) {
            setError(e.message || '新增失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveUser = async (email: string) => {
        if (!trip.serverTripId) return;

        setIsLoading(true);
        try {
            const newList = allowedUsers.filter(u => u !== email);
            await tripShareService.updatePermissions(trip.serverTripId, newList);
            setAllowedUsers(newList);
        } catch (e: any) {
            setError(e.message || '移除失敗');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-sky-400 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
                            <Link2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">分享旅程</h2>
                            <p className="text-xs text-gray-500">
                                {isPublic ? '所有人都可以查看' : '僅授權用戶可查看'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Visibility Status */}
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${isPublic
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                        }`}>
                        {isPublic ? (
                            <Globe className="w-5 h-5 text-green-600" />
                        ) : (
                            <Lock className="w-5 h-5 text-amber-600" />
                        )}
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${isPublic ? 'text-green-700' : 'text-amber-700'}`}>
                                {isPublic ? '公開旅程' : '私人旅程'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isPublic
                                    ? '任何人都可以透過連結查看此旅程'
                                    : '只有下方列表中的用戶可以查看'}
                            </p>
                        </div>
                    </div>

                    {/* Share Link */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            分享連結
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 truncate"
                            />
                            <button
                                onClick={handleCopy}
                                className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 ${copied
                                    ? 'bg-green-500 text-white'
                                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-200 hover:-translate-y-0.5'
                                    }`}
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        已複製
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        複製
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Private Mode: Permission Management */}
                    {!isPublic && trip.serverTripId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                授權查看者
                            </label>

                            {/* Add User */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="email"
                                    placeholder="輸入 Email 新增授權者..."
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                />
                                <button
                                    onClick={handleAddUser}
                                    disabled={!newEmail.trim() || isLoading}
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-brand-50 text-gray-600 hover:text-brand-600 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    新增
                                </button>
                            </div>

                            {/* Error */}
                            {error && (
                                <p className="text-red-500 text-xs mb-2">{error}</p>
                            )}

                            {/* User List */}
                            <div className="bg-gray-50 rounded-xl border border-gray-100 max-h-40 overflow-y-auto">
                                {allowedUsers.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-6">
                                        尚未授權任何用戶
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {allowedUsers.map((email) => (
                                            <li
                                                key={email}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors group"
                                            >
                                                <span className="text-sm text-gray-700 truncate">{email}</span>
                                                <button
                                                    onClick={() => handleRemoveUser(email)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
                    <p className="text-xs text-gray-400 text-center">
                        {isPublic
                            ? '提示：將旅程設為私人可限制特定用戶查看'
                            : '提示：將旅程設為公開可讓任何人查看'}
                    </p>
                </div>
            </div>
        </div>
    );
}
