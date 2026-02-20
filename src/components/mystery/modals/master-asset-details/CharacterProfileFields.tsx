import React from 'react';

type CharacterProfileFieldsProps = {
  busy: boolean;
  isAdmin: boolean;
  fields: any;
  voiceProfiles: any[];
  setFields: React.Dispatch<React.SetStateAction<any>>;
};

export function CharacterProfileFields({ busy, isAdmin, fields, voiceProfiles, setFields }: CharacterProfileFieldsProps) {
  return (
    <div className="row g-2">
      <div className="col-12">
        <label className="form-label">Voice Profile</label>
        <select
          className="form-select"
          value={fields.voice_profile_id || '0'}
          onChange={(e) => setFields((p: any) => ({ ...p, voice_profile_id: e.target.value }))}
          disabled={busy || !isAdmin}
        >
          <option value="0">(None)</option>
          {voiceProfiles.map((vp) => (
            <option key={vp.id} value={vp.id}>{vp.display_name || vp.voice_id}</option>
          ))}
        </select>
      </div>
      <div className="col-6"><label className="form-label">DOB</label><input type="date" className="form-control" value={fields.dob || ''} onChange={(e) => setFields((p: any) => ({ ...p, dob: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-6"><label className="form-label">Age</label><input type="number" className="form-control" value={fields.age || ''} onChange={(e) => setFields((p: any) => ({ ...p, age: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Hometown</label><input className="form-control" value={fields.hometown || ''} onChange={(e) => setFields((p: any) => ({ ...p, hometown: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Address</label><input className="form-control" value={fields.address || ''} onChange={(e) => setFields((p: any) => ({ ...p, address: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Ethnicity</label><input className="form-control" value={fields.ethnicity || ''} onChange={(e) => setFields((p: any) => ({ ...p, ethnicity: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-6"><label className="form-label">Zodiac</label><input className="form-control" value={fields.zodiac || ''} onChange={(e) => setFields((p: any) => ({ ...p, zodiac: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-6"><label className="form-label">MBTI</label><input className="form-control" value={fields.mbti || ''} onChange={(e) => setFields((p: any) => ({ ...p, mbti: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-6"><label className="form-label">Height</label><input className="form-control" value={fields.height || ''} onChange={(e) => setFields((p: any) => ({ ...p, height: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-6"><label className="form-label">Weight</label><input className="form-control" value={fields.weight || ''} onChange={(e) => setFields((p: any) => ({ ...p, weight: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Eye Color</label><input className="form-control" value={fields.eye_color || ''} onChange={(e) => setFields((p: any) => ({ ...p, eye_color: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Hair Color</label><input className="form-control" value={fields.hair_color || ''} onChange={(e) => setFields((p: any) => ({ ...p, hair_color: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Aliases (one per line)</label><textarea className="form-control" rows={2} value={(fields.aliases || []).join('\n')} onChange={(e) => setFields((p: any) => ({ ...p, aliases: e.target.value.split('\n').filter(Boolean) }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Employment (one per line)</label><textarea className="form-control" rows={2} value={(fields.employment || []).join('\n')} onChange={(e) => setFields((p: any) => ({ ...p, employment: e.target.value.split('\n').filter(Boolean) }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Marks</label><textarea className="form-control" rows={2} value={fields.distinguishing_marks || ''} onChange={(e) => setFields((p: any) => ({ ...p, distinguishing_marks: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Education</label><textarea className="form-control" rows={2} value={fields.education || ''} onChange={(e) => setFields((p: any) => ({ ...p, education: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Fav Color</label><input className="form-control" value={fields.fav_color || ''} onChange={(e) => setFields((p: any) => ({ ...p, fav_color: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Fav Snack</label><input className="form-control" value={fields.fav_snack || ''} onChange={(e) => setFields((p: any) => ({ ...p, fav_snack: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Fav Drink</label><input className="form-control" value={fields.fav_drink || ''} onChange={(e) => setFields((p: any) => ({ ...p, fav_drink: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Fav Music</label><input className="form-control" value={fields.fav_music || ''} onChange={(e) => setFields((p: any) => ({ ...p, fav_music: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Fav Hobby</label><input className="form-control" value={fields.fav_hobby || ''} onChange={(e) => setFields((p: any) => ({ ...p, fav_hobby: e.target.value }))} disabled={busy || !isAdmin} /></div>
      <div className="col-12"><label className="form-label">Fav Pet</label><input className="form-control" value={fields.fav_pet || ''} onChange={(e) => setFields((p: any) => ({ ...p, fav_pet: e.target.value }))} disabled={busy || !isAdmin} /></div>
    </div>
  );
}
