import { createSvgIcon } from '@mui/material/utils';

// The "reorder" icon of the Rooms setup (owner pictures): two bars with a small up triangle above and
// a small down triangle below. The Figma slot beside New Room (12635:24242) holds a plain four-bar
// glyph that does not match the pictures, so this one is drawn to match them.
const ReorderIcon = createSvgIcon(
  <path d="M12 2.5l-3.5 4h7zM4 9h16v2H4zM4 13h16v2H4zM12 21.5l3.5-4h-7z" />,
  'Reorder',
);

export default ReorderIcon;
