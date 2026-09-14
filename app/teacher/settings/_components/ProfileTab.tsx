'use client';

import { AtSign, Phone, Briefcase, MapPin, CheckCircle, XCircle, Save } from 'lucide-react';

import { Button, Spinner } from '@/components/ui';

export default function ProfileTab({
  formData, setFormData, saving, usernameStatus, usernameError, handleSaveProfile, t, UZB_LOCATIONS, formatPhoneNumber
}: any) {
  return (
    <div className="bg-surface-container-low rounded-m3-lg overflow-hidden shadow-elev-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 md:p-8 border-b border-outline-variant bg-surface-container flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-black text-on-surface tracking-tight">{t.profile.title}</h2>
          <p className="text-[13px] font-medium text-on-surface-variant mt-1">{t.profile.subtitle}</p>
        </div>
        <Button
          variant="filled"
          onClick={handleSaveProfile}
          loading={saving}
          disabled={usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid'}
          icon={<Save size={16}/>}
        >
          <span className="hidden sm:inline">{t.profile.save}</span>
        </Button>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Display Name */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.profile.fullName}</label>
            <input type="text" value={formData.displayName} onChange={(e) => setFormData({...formData, displayName: e.target.value})} className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all"/>
          </div>

          {/* Username */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.profile.username}</label>
            <div className="relative group">
              <AtSign className="absolute left-4 top-3.5 text-on-surface-variant" size={16}/>
              <input
                type="text" value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().trim()})}
                className={`w-full pl-11 pr-10 py-3 border rounded-m3-md font-bold text-[14px] outline-none transition-all ${
                  usernameStatus === 'valid' ? 'border-success bg-success-container text-on-success-container' :
                  usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-error bg-error-container text-on-error-container' :
                  'border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary text-on-surface'
                }`}
              />
              <div className="absolute right-4 top-3.5">
                {usernameStatus === 'checking' && <Spinner size={16}/>}
                {usernameStatus === 'valid' && <CheckCircle className="text-success" size={16}/>}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle className="text-error" size={16}/>}
              </div>
            </div>
            {usernameStatus === 'taken' && <p className="text-[10px] font-bold text-error uppercase tracking-wider mt-1.5 ml-1">{t.profile.usernameTaken}</p>}
            {usernameStatus === 'valid' && formData.username !== formData.originalUsername && <p className="text-[10px] font-bold text-success uppercase tracking-wider mt-1.5 ml-1">{t.profile.usernameAvail}</p>}
          </div>

          {/* Bio */}
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest">{t.profile.bio}</label>
              <span className={`text-[10px] font-black tracking-widest ${formData.bio?.length >= 100 ? 'text-error' : 'text-on-surface-variant'}`}>
                {formData.bio?.length || 0}/100
              </span>
            </div>
            <textarea
              rows={3} maxLength={100} value={formData.bio || ''} onChange={(e) => setFormData({...formData, bio: e.target.value})} placeholder={t.profile.bioPlace}
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none resize-none transition-all"
            />
          </div>

          {/* 🟢 NEW SECTION: Professional Info */}
          <div className="col-span-2 border-t border-outline-variant pt-6 mt-2">
            <label className="block text-[11px] font-black text-primary uppercase tracking-widest mb-3">{t.profile.professionalInfo}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Gender */}
              <div>
                <select value={formData.gender || ''} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all">
                  <option value="">{t.profile.gender || "Jinsi (Gender)"}</option>
                  <option value="male">{t.profile.male}</option>
                  <option value="female">{t.profile.female}</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <select value={formData.subject || ''} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all">
                  <option value="">{t.profile.subject || "Fani"}</option>
                  <option value="matematika">{t.profile.subjects.matematika}</option>
                  <option value="fizika">{t.profile.subjects.fizika}</option>
                  <option value="kimyo">{t.profile.subjects.kimyo}</option>
                  <option value="biologiya">{t.profile.subjects.biologiya}</option>
                  <option value="informatika">{t.profile.subjects.informatika}</option>
                  <option value="ona_tili">{t.profile.subjects.ona_tili}</option>
                  <option value="tarix">{t.profile.subjects.tarix}</option>
                  <option value="ingliz_tili">{t.profile.subjects.ingliz_tili}</option>
                  <option value="rus_tili">{t.profile.subjects.rus_tili}</option>
                  <option value="geografiya">{t.profile.subjects.geografiya}</option>
                  <option value="other">{t.profile.subjects.other}</option>
                </select>
              </div>

              {/* Experience (Saved as Integer) */}
              <div>
                <input
                  type="number" min="0" max="60"
                  value={formData.experience === 0 && !formData.experience ? '' : formData.experience}
                  onChange={(e) => setFormData({...formData, experience: parseInt(e.target.value) || 0})}
                  placeholder={t.profile.experience || "Tajriba (Yil)"}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all"
                />
              </div>

            </div>
          </div>

          {/* Email */}
          <div className="mt-4">
            <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.profile.email}</label>
            <div className="px-4 py-3 bg-surface-container-high rounded-m3-md text-on-surface-variant font-mono text-[13px] font-bold border border-outline-variant cursor-not-allowed truncate">{formData.email}</div>
          </div>

          {/* Phone (Using your exact Signup Formatter) */}
          <div className="mt-4">
            <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.profile.phone}</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16}/>
              <input
                type="tel" value={formData.phone} maxLength={19}
                onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                placeholder={t.profile.phonePlace || "+998"}
                className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          {/* Birth Date (Restored to <input type="date">) */}
          <div>
            <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.profile.dob}</label>
            <input
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={formData.birthDate || ''}
              onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
              className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all"
            />
          </div>

          {/* Institution */}
          <div>
            <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.profile.institution}</label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16}/>
              <input type="text" value={formData.institution} onChange={(e) => setFormData({...formData, institution: e.target.value})} className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all"/>
            </div>
          </div>

          {/* Location */}
          <div className="col-span-2 border-t border-outline-variant pt-6 mt-2">
            <label className="text-[11px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-1.5"><MapPin size={14}/> {t.profile.location}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select value={formData.location?.region || ''} onChange={(e) => setFormData({...formData, location: { ...formData.location, region: e.target.value, district: '' }})} className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all">
                <option value="">{t.profile.region || "Viloyatni tanlang"}</option>
                {Object.keys(UZB_LOCATIONS).map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
              <select value={formData.location?.district || ''} onChange={(e) => setFormData({...formData, location: { ...formData.location, district: e.target.value }})} disabled={!formData.location?.region} className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary outline-none transition-all disabled:opacity-50 disabled:bg-surface-container-high">
                <option value="">{t.profile.district || "Tumanni tanlang"}</option>
                {formData.location?.region && UZB_LOCATIONS[formData.location.region]?.map((district: string) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}