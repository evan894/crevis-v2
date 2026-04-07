import QRCode from 'qrcode';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

const SAFFRON = '#F4631E';
const QR_SIZE = 800;
const LOGO_SIZE = 160;

export const generateStoreQR = async (
  shopSlug: string,
): Promise<string> => {
  const storeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/s/${shopSlug}`;

  // Generate QR as PNG buffer — saffron dots on white
  const qrBuffer = await QRCode.toBuffer(storeUrl, {
    type: 'png',
    width: QR_SIZE,
    margin: 2,
    color: {
      dark: SAFFRON,
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H', // 30% can be covered by logo
  });

  // Load logo from public folder (server-side filesystem read)
  const logoPath = path.join(process.cwd(), 'public', 'crevis-logo-qr.png');
  const logoRaw = fs.readFileSync(logoPath);

  // Resize logo to exact size, then composite onto center
  const logoResized = await sharp(logoRaw)
    .resize(LOGO_SIZE, LOGO_SIZE)
    .png()
    .toBuffer();

  const finalQR = await sharp(qrBuffer)
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toBuffer();

  // Upload to Supabase Storage (upsert: false — permanent)
  const fileName = `${shopSlug}.png`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('qr-codes')
    .upload(fileName, finalQR, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError && uploadError.message !== 'The resource already exists') {
    throw new Error(`QR upload failed: ${uploadError.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from('qr-codes')
    .getPublicUrl(fileName);

  // Persist URL to seller record
  await supabaseAdmin
    .from('sellers')
    .update({ qr_code_url: data.publicUrl })
    .eq('shop_slug', shopSlug);

  return data.publicUrl;
};

export const regenerateStoreQR = async (
  shopSlug: string,
): Promise<string> => {
  // Remove old QR from storage first
  await supabaseAdmin.storage
    .from('qr-codes')
    .remove([`${shopSlug}.png`]);

  // Clear the cached URL so dashboard triggers a fresh generate
  await supabaseAdmin
    .from('sellers')
    .update({ qr_code_url: null })
    .eq('shop_slug', shopSlug);

  // Re-generate with upsert: true this time
  const storeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/s/${shopSlug}`;

  const qrBuffer = await QRCode.toBuffer(storeUrl, {
    type: 'png',
    width: QR_SIZE,
    margin: 2,
    color: { dark: SAFFRON, light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });

  const logoPath = path.join(process.cwd(), 'public', 'crevis-logo-qr.png');
  const logoRaw = fs.readFileSync(logoPath);
  const logoResized = await sharp(logoRaw).resize(LOGO_SIZE, LOGO_SIZE).png().toBuffer();
  const finalQR = await sharp(qrBuffer)
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toBuffer();

  const fileName = `${shopSlug}.png`;
  await supabaseAdmin.storage
    .from('qr-codes')
    .upload(fileName, finalQR, { contentType: 'image/png', upsert: true });

  const { data } = supabaseAdmin.storage.from('qr-codes').getPublicUrl(fileName);

  await supabaseAdmin
    .from('sellers')
    .update({ qr_code_url: data.publicUrl })
    .eq('shop_slug', shopSlug);

  return data.publicUrl;
};
