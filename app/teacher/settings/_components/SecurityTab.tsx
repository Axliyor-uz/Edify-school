'use client';

import { Lock, Trash2, Eye, EyeOff, AlertTriangle, Layout, BookOpen, Building2 } from 'lucide-react';

import { Button, IconButton } from '@/components/ui';

export default function SecurityTab({
  classList, setClassToDelete, isGoogleUser, passwords, setPasswords, showPass, setShowPass,
  handleChangePassword, saving, showDeleteConfirm, setShowDeleteConfirm, deletePassword,
  setDeletePassword, handleDeleteAccount, isDeleting, t
}: any) {

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* 1. CLASS MANAGEMENT */}
      <div className="bg-surface-container-low rounded-m3-lg overflow-hidden shadow-elev-1">
        <div className="p-6 md:p-8 border-b border-outline-variant flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-container rounded-m3-md flex items-center justify-center text-on-primary-container"><Layout size={20}/></div>
          <div>
            <h2 className="text-[16px] font-black text-on-surface">{t.security.manageClasses}</h2>
            <p className="text-[12px] font-medium text-on-surface-variant">{t.security.manageSub}</p>
          </div>
        </div>
        <div className="p-6 md:p-8">
            {classList.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant text-[13px] font-bold bg-surface-container rounded-m3-lg border border-dashed border-outline-variant">{t.security.noClasses}</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {classList.map((cls: any) => (
                        <div key={cls.id} className="flex items-center justify-between p-4 border border-outline-variant rounded-m3-md hover:border-outline hover:shadow-elev-1 transition-all bg-surface-container-lowest">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-container text-on-primary-container rounded-m3-md flex items-center justify-center font-bold"><BookOpen size={16}/></div>
                                <div>
                                    <h3 className="font-bold text-on-surface text-[14px] line-clamp-1">{cls.title}</h3>
                                    <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mt-0.5">{cls.studentIds?.length || 0} {t.security.students}</p>
                                </div>
                            </div>
                            {cls.centerId ? (
                                // Markaz guruhi: deleteClassAPI (Admin SDK, rules'ni chetlab o'tadi)
                                // shu yerdan chaqirilmasligi shart — o'chirish menejerniki.
                                <span title={t.security.centerManaged} className="w-9 h-9 flex items-center justify-center rounded-m3-sm bg-tertiary-container text-on-tertiary-container shrink-0">
                                    <Building2 size={16} strokeWidth={2.5} />
                                </span>
                            ) : (
                                <IconButton aria-label={t.security.deleteClassAria} onClick={() => setClassToDelete({ id: cls.id, title: cls.title })} className="hover:text-error hover:bg-error-container"><Trash2 size={18}/></IconButton>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* 2. PASSWORD SECURITY */}
      {!isGoogleUser && (
        <div className="bg-surface-container-low rounded-m3-lg overflow-hidden shadow-elev-1">
          <div className="p-6 md:p-8 border-b border-outline-variant flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary-container rounded-m3-md flex items-center justify-center text-on-secondary-container"><Lock size={20}/></div>
            <div>
              <h2 className="text-[16px] font-black text-on-surface">{t.security.passwordTitle}</h2>
              <p className="text-[12px] font-medium text-on-surface-variant">{t.security.passwordSub}</p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.security.currentPass}</label>
                <div className="relative">
                  <input type={showPass.current ? "text" : "password"} value={passwords.current} onChange={(e) => setPasswords({...passwords, current: e.target.value})} className="w-full px-4 py-3 border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all bg-surface-container-lowest" placeholder={t.security.currentPlace} />
                  <IconButton size="sm" aria-label={showPass.current ? t.security.hidePassAria : t.security.showPassAria} onClick={() => setShowPass({...showPass, current: !showPass.current})} className="absolute right-2 top-1/2 -translate-y-1/2">{showPass.current ? <EyeOff size={18}/> : <Eye size={18}/>}</IconButton>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.security.newPass}</label>
                <div className="relative">
                  <input type={showPass.new ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} className="w-full px-4 py-3 border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all bg-surface-container-lowest" placeholder={t.security.newPlace} />
                  <IconButton size="sm" aria-label={showPass.new ? t.security.hidePassAria : t.security.showPassAria} onClick={() => setShowPass({...showPass, new: !showPass.new})} className="absolute right-2 top-1/2 -translate-y-1/2">{showPass.new ? <EyeOff size={18}/> : <Eye size={18}/>}</IconButton>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.security.confirmPass}</label>
                <div className="relative">
                  <input type={showPass.confirm ? "text" : "password"} value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} className={`w-full px-4 py-3 border rounded-m3-md text-[14px] font-bold text-on-surface outline-none transition-all ${passwords.confirm && passwords.new !== passwords.confirm ? 'border-error bg-error-container focus:border-error focus:ring-1 focus:ring-inset focus:ring-error' : 'border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary'}`} placeholder={t.security.confirmPlace} />
                  <IconButton size="sm" aria-label={showPass.confirm ? t.security.hidePassAria : t.security.showPassAria} onClick={() => setShowPass({...showPass, confirm: !showPass.confirm})} className="absolute right-2 top-1/2 -translate-y-1/2">{showPass.confirm ? <EyeOff size={18}/> : <Eye size={18}/>}</IconButton>
                </div>
              </div>
              <div className="md:col-span-2 pt-2 flex justify-end">
                <Button
                  variant="filled"
                  onClick={handleChangePassword}
                  loading={saving}
                  disabled={!passwords.current || !passwords.new || (passwords.new !== passwords.confirm)}
                >
                  {saving ? t.security.updating : t.security.updateBtn}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DANGER ZONE */}
      <div className="bg-[color-mix(in_oklab,var(--m3-error)_4%,var(--m3-surface-container-low))] border border-error-container rounded-m3-lg overflow-hidden shadow-elev-1">
        <div className="p-6 md:p-8 border-b border-error-container flex items-center gap-3">
          <div className="w-10 h-10 bg-error-container rounded-m3-md flex items-center justify-center text-on-error-container"><AlertTriangle size={20}/></div>
          <div>
            <h2 className="text-[16px] font-black text-error">{t.security.dangerTitle}</h2>
            <p className="text-[12px] font-medium text-on-surface-variant">{t.security.dangerSub}</p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {!showDeleteConfirm ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-on-surface text-[14px]">{t.security.deleteAccount}</h3>
                <p className="text-[13px] font-medium text-on-surface-variant mt-1">{t.security.deleteWarning}</p>
              </div>
              <Button variant="danger-text" onClick={() => setShowDeleteConfirm(true)} className="bg-surface-container-lowest ring-1 ring-inset ring-error-container shadow-elev-1 px-6 whitespace-nowrap">
                {t.security.deleteAccount}
              </Button>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-6 md:p-8 rounded-m3-lg border border-error-container shadow-elev-1 animate-in zoom-in-95">
              <h3 className="text-[16px] font-black text-on-surface mb-2">{t.security.confirmDelete}</h3>
              {isGoogleUser ? (
                <p className="text-[13px] font-medium text-on-surface-variant mb-6">{t.security.googleConfirm}</p>
              ) : (
                <>
                  <p className="text-[13px] font-medium text-on-surface-variant mb-4">{t.security.passConfirm}</p>
                  <input type="password" placeholder={t.security.currentPlace} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface outline-none focus:border-error focus:ring-1 focus:ring-inset focus:ring-error transition-all mb-6 bg-surface-container-lowest" />
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="tonal" className="flex-1" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}>
                  {t.security.cancel}
                </Button>
                <Button variant="danger" className="flex-1" onClick={handleDeleteAccount} loading={isDeleting} disabled={!isGoogleUser && !deletePassword} icon={<Trash2 size={16}/>}>
                  {t.security.yesDelete}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}