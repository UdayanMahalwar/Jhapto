import React from 'react';
import { ImagePlus } from 'lucide-react';

// Styled image picker with preview. The parent uploads the file in onChange
// and passes the resulting URL back as `value`.
const FilePicker = ({ value, uploading, onChange, onRemove, inputKey, label = 'Add a photo', hint = 'PNG, JPEG, GIF or WebP · max 4 MB', capture }) => (
  <div className="row" style={{ flexWrap: 'nowrap' }}>
    <label className="file-picker" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <input
        key={inputKey}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        capture={capture}
        onChange={onChange}
        disabled={uploading}
      />
      {value && !uploading
        ? <img className="file-picker-thumb" src={value} alt="Selected" />
        : <span className="file-picker-thumb"><ImagePlus size={20} /></span>}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem' }}>
          {uploading ? 'Uploading…' : value ? 'Photo added — tap to change' : label}
        </span>
        <span className="field-hint">{hint}</span>
      </span>
    </label>
    {value && !uploading && onRemove && (
      <button type="button" className="btn-link danger btn" onClick={onRemove}>Remove</button>
    )}
  </div>
);

export default FilePicker;
