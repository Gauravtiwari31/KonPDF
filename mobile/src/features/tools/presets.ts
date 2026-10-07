/**
 * Resize presets. The ids match the engine's (engine/app/tools/resize.py),
 * which holds the real numbers; these labels are for the chips.
 */
export interface PresetDef {
  id: string;
  label: string;
  detail: string;
}

export const PRESET_GROUPS: { title: string; presets: PresetDef[] }[] = [
  {
    title: 'ID and forms',
    presets: [
      { id: 'passport', label: 'Passport photo', detail: '35 × 45 mm' },
      { id: 'us_visa', label: 'US visa', detail: '2 × 2 in' },
      { id: 'india_form_photo', label: 'Govt. form photo', detail: '3.5 × 4.5 cm · 20–50 KB' },
      { id: 'signature', label: 'Signature', detail: '140 × 60 px · 10–20 KB' },
      { id: 'id_scan', label: 'ID card scan', detail: 'Under 300 KB' },
    ],
  },
  {
    title: 'Social',
    presets: [
      { id: 'instagram_square', label: 'Instagram post', detail: '1080 × 1080' },
      { id: 'instagram_portrait', label: 'Instagram portrait', detail: '1080 × 1350' },
      { id: 'instagram_story', label: 'Story / Reel', detail: '1080 × 1920' },
      { id: 'whatsapp_dp', label: 'WhatsApp DP', detail: '500 × 500' },
      { id: 'youtube_thumb', label: 'YouTube thumbnail', detail: '1280 × 720' },
      { id: 'linkedin_banner', label: 'LinkedIn banner', detail: '1584 × 396' },
      { id: 'x_header', label: 'X header', detail: '1500 × 500' },
    ],
  },
  {
    title: 'Screens, print, email',
    presets: [
      { id: 'hd', label: 'HD', detail: '1280 × 720' },
      { id: 'full_hd', label: 'Full HD', detail: '1920 × 1080' },
      { id: 'uhd_4k', label: '4K', detail: '3840 × 2160' },
      { id: 'a4_300dpi', label: 'A4 print', detail: '300 DPI' },
      { id: 'email', label: 'Small for email', detail: '1280 px · < 500 KB' },
    ],
  },
];

export const findPreset = (id: string) =>
  PRESET_GROUPS.flatMap(g => g.presets).find(p => p.id === id);
