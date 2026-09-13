import { HUMAN_AVATAR_IDS, type HumanAvatarId } from "../../game/avatars";
import { AVATAR_IMAGE } from "../../game/avatarImages";
import "./AvatarPicker.css";

export interface AvatarPickerProps {
  value: HumanAvatarId;
  onChange: (avatar: HumanAvatarId) => void;
}

/** A fixed set of illustrated avatars to pick from before joining/creating a room. */
export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="avatar-grid" role="radiogroup" aria-label="Dein Avatar">
      {HUMAN_AVATAR_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={`avatar-option ${value === id ? "avatar-option--selected" : ""}`}
          onClick={() => onChange(id)}
        >
          <img className="avatar-option__img" src={AVATAR_IMAGE[id]} alt="" />
        </button>
      ))}
    </div>
  );
}
