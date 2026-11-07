import { useState } from 'react';
import EditFieldModal, { EditRequest } from './EditFieldModal';
import { Avatar, FieldBox, SectionCard } from './ui';
import { COACH_CREDENTIALS, COACH_EXPERIENCE, FieldSpec, displayValue, headerClub, sectionsFor } from './fields';

// The body of the app's Profile screen: the photo/name/club header, then the
// account type's sections of tappable fields, each opening its edit modal.
// On a wide screen the sections flow into two columns.

export type ProfileKind = 'youth' | 'collegiate' | 'professional' | 'coach';

interface Props {
  kind: ProfileKind;
  doc: any;
  /** Saves one field; omit for a read-only profile. */
  onSaveField?: (field: string, value: any) => Promise<void>;
  photoUrl?: string;
  onPickPhoto?: (file: File) => void;
  uploadingPhoto?: boolean;
  /** Shown between the header and the sections. */
  notice?: React.ReactNode;
  /** Shown after the sections (e.g. Switch Account Type). */
  footer?: React.ReactNode;
}

const ProfileView = ({ kind, doc, onSaveField, photoUrl, onPickPhoto, uploadingPhoto, notice, footer }: Props) => {
  const [editing, setEditing] = useState<EditRequest | null>(null);
  const editable = !!onSaveField;
  const name = `${doc?.firstName || ''} ${doc?.lastName || ''}`.trim();
  const club = headerClub(kind, doc);

  const open = (f: FieldSpec) =>
    editable && setEditing({ field: f.field, type: f.type, title: f.title, value: doc?.[f.field] ?? '', options: f.options });

  const field = (f: FieldSpec) => (
    <FieldBox
      key={f.field}
      label={f.label}
      value={displayValue(doc?.[f.field])}
      onClick={editable ? () => open(f) : undefined}
      disabled={!editable}
    />
  );

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Profile header */}
      <div className="bg-[#111] border border-[#222] rounded-2xl px-5 py-5 md:px-8 md:py-7 flex items-center gap-4 md:gap-7">
        <Avatar
          url={photoUrl}
          onPick={onPickPhoto}
          uploading={uploadingPhoto}
          sizeClass="w-[72px] h-[72px] md:w-[112px] md:h-[112px]"
          badgeClass="w-6 h-6 text-[15px] md:w-8 md:h-8 md:text-lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-white text-[22px] md:text-4xl font-bold truncate">{name || 'Your profile'}</h2>
          {club && <p className="text-[#888] text-[13px] md:text-base mt-0.5 md:mt-1.5 truncate">{club}</p>}
        </div>
      </div>

      {notice}

      {kind === 'coach' ? (
        <div className="space-y-5 md:space-y-6">
          <SectionCard>
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
              {COACH_EXPERIENCE.map(({ field: key, title }) => {
                const values: string[] = Array.isArray(doc?.[key]) ? doc[key] : [];
                const slots = [...values];
                while (slots.length < 3) slots.push('');
                return (
                  <div key={key} className="space-y-5">
                    {slots.slice(0, 3).map((v, i) => (
                      <FieldBox
                        key={i}
                        label={`${title} #${i + 1}`}
                        value={displayValue(v)}
                        disabled={!editable}
                        onClick={editable ? () => setEditing({ field: key, type: 'experience', title, value: values }) : undefined}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </SectionCard>
          <SectionCard>
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">{COACH_CREDENTIALS.map(field)}</div>
          </SectionCard>
        </div>
      ) : (
        <div className="lg:columns-2 lg:gap-6">
          {sectionsFor(kind).map((s, i) => (
            <SectionCard key={s.title || i} title={s.title} className="break-inside-avoid mb-5 md:mb-6">
              <div className="space-y-5">
                {s.rows.map((row, j) => (
                  <div key={j} className={`grid gap-4 ${row.length > 1 ? 'grid-cols-2' : ''}`}>
                    {row.map(field)}
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {footer}

      {editing && onSaveField && (
        <EditFieldModal request={editing} onClose={() => setEditing(null)} onSave={onSaveField} />
      )}
    </div>
  );
};

export default ProfileView;
