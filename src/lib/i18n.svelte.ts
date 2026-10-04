// Plain dictionaries: French is typed against English, so a missing translation fails the type check.

const en = {
  tagline: 'Hide faces in photos and videos. Everything runs on your device: your files are never uploaded.',
  choose: 'Choose photos or a video',
  dropHere: 'or drop them here',
  warning:
    'Check everything before sharing: automatic detection can miss faces. Clothing, tattoos, banners, and places can still identify people, and your phone may have backed up the original to the cloud.',
  offline: 'Saved on this device: Masque now works without an internet connection.',
  backendGpu: 'Detection runs on your GPU (WebGPU).',
  backendCpu: 'Detection runs on your CPU (WebAssembly).',
  detectorFailed: (m: string) => `The face detector could not start: ${m}`,
  oneVideo: 'Open videos one at a time: each needs its own review.',
  language: 'Language',
  masking: 'Masking',
  style: 'Style',
  solid: 'Solid (safest)',
  mosaic: 'Mosaic',
  blur: 'Blur',
  weakWarning: 'Mosaic and blur leave some information behind. Use solid for the strongest protection.',
  threshold: 'Detection threshold',
  thresholdHelp: 'Lower values catch more faces, along with more false positives.',
  maskSize: 'Mask size',
  oval: 'Oval masks',
  editorLabel:
    'Image with hidden faces. Drag to add a mask; select a mask to move it, resize it from its corner, or delete it.',
  masks: (n: number) => `${n} ${n === 1 ? 'mask' : 'masks'}`,
  manualMask: 'Manual mask',
  face: (n: number, score: string) => `Face ${n} (${score})`,
  remove: 'Remove',
  removeMaskN: (n: number) => `Remove mask ${n}`,
  removeMask: 'Remove mask',
  preview: 'Preview',
  lookingForFaces: 'Looking for faces…',
  download: 'Download',
  startOver: 'Start over',
  detectionFailed: (m: string) => `Face detection failed: ${m}. You can still add masks by hand.`,
  cannotOpen: (name: string) => `Your browser cannot open “${name}”. Convert it to JPEG or PNG and try again.`,
  cannotProcess: (name: string, m: string) => `Cannot process “${name}”: ${m}`,
  exportFailed: (m: string) => `Export failed: ${m}`,
  exporting: 'Exporting…',
  previousFrame: 'Previous frame',
  nextFrame: 'Next frame',
  frame: 'Frame',
  selectedMask: 'Selected mask',
  selectedRange: (start: number, end: number) => `Selected mask: frames ${start}–${end}`,
  startsHere: 'Starts here',
  endsHere: 'Ends here',
  removeSound: 'Remove sound (voices can identify people)',
  cancel: 'Cancel',
  secondsLeft: (n: number) => `${n} s left`,
  minutesLeft: (n: number) => `${n} min left`,
  unreadable: 'cannot open',
  lookingProgress: (done: number, total: number) => `Looking for faces… ${done}/${total}`,
  downloadAll: (n: number) => `Download all (${n} photos, ZIP)`,
  'error.noVideo': 'This file has no video.',
  'error.cannotDecode': 'Your browser cannot decode this video format.',
  'error.cannotEncode': 'Your browser cannot encode this video.',
  about: 'About',
  aboutText:
    'Masque hides the faces of people in photos and videos of demonstrations, so you can share them without exposing protesters. It runs entirely in your browser: your files never leave your device. Masque is free software, under the AGPL license.',
  createdBy: 'Created by',
  onestlaDescription: 'A collective of tech workers engaged in social struggles.',
  offensiveDescription: 'A libertarian municipalist organization in Lille: social ecology, feminism, antifascism, and direct democracy.',
  credits: 'Credits',
  creditCenterface: 'face detection model',
  creditDeface: 'the command-line tool Masque builds on',
  creditOnnx: 'runs the model in your browser',
  creditMediabunny: 'video decoding and encoding',
  creditSvelte: 'user interface',
  creditFflate: 'ZIP archives',
  creditPlex: 'typeface',
}

const fr: typeof en = {
  tagline: 'Masquez les visages sur vos photos et vidéos. Tout se passe sur votre appareil : vos fichiers ne sont jamais envoyés.',
  choose: 'Choisissez des photos ou une vidéo',
  dropHere: 'ou déposez-les ici',
  warning:
    'Vérifiez tout avant de partager : la détection automatique peut manquer des visages. Vêtements, tatouages, banderoles et lieux peuvent encore permettre d’identifier des personnes, et votre téléphone a peut-être déjà sauvegardé l’original dans le cloud.',
  offline: 'Enregistré sur cet appareil : Masque fonctionne désormais sans connexion internet.',
  backendGpu: 'La détection s’exécute sur votre processeur graphique (WebGPU).',
  backendCpu: 'La détection s’exécute sur votre processeur (WebAssembly).',
  detectorFailed: (m) => `Le détecteur de visages n’a pas pu démarrer : ${m}`,
  oneVideo: 'Ouvrez les vidéos une par une : chacune doit être vérifiée.',
  language: 'Langue',
  masking: 'Masquage',
  style: 'Style',
  solid: 'Plein (le plus sûr)',
  mosaic: 'Mosaïque',
  blur: 'Flou',
  weakWarning: 'La mosaïque et le flou laissent passer des informations. Choisissez « Plein » pour la meilleure protection.',
  threshold: 'Seuil de détection',
  thresholdHelp: 'Une valeur basse détecte plus de visages, mais aussi plus de faux positifs.',
  maskSize: 'Taille des masques',
  oval: 'Masques ovales',
  editorLabel:
    'Image aux visages masqués. Faites glisser pour ajouter un masque ; sélectionnez un masque pour le déplacer, le redimensionner par son coin ou le supprimer.',
  masks: (n) => `${n} ${n > 1 ? 'masques' : 'masque'}`,
  manualMask: 'Masque manuel',
  face: (n, score) => `Visage ${n} (${score})`,
  remove: 'Supprimer',
  removeMaskN: (n) => `Supprimer le masque ${n}`,
  removeMask: 'Supprimer le masque',
  preview: 'Aperçu',
  lookingForFaces: 'Recherche des visages…',
  download: 'Télécharger',
  startOver: 'Recommencer',
  detectionFailed: (m) => `La détection des visages a échoué : ${m}. Vous pouvez toujours ajouter des masques à la main.`,
  cannotOpen: (name) => `Votre navigateur ne peut pas ouvrir « ${name} ». Convertissez-le en JPEG ou PNG, puis réessayez.`,
  cannotProcess: (name, m) => `Impossible de traiter « ${name} » : ${m}`,
  exportFailed: (m) => `L’export a échoué : ${m}`,
  exporting: 'Export en cours…',
  previousFrame: 'Image précédente',
  nextFrame: 'Image suivante',
  frame: 'Image',
  selectedMask: 'Masque sélectionné',
  selectedRange: (start, end) => `Masque sélectionné : images ${start} à ${end}`,
  startsHere: 'Commence ici',
  endsHere: 'Finit ici',
  removeSound: 'Supprimer le son (les voix peuvent identifier des personnes)',
  cancel: 'Annuler',
  secondsLeft: (n) => `encore ${n} s`,
  minutesLeft: (n) => `encore ${n} min`,
  unreadable: 'illisible',
  lookingProgress: (done, total) => `Recherche des visages… ${done}/${total}`,
  downloadAll: (n) => `Tout télécharger (${n} photos, ZIP)`,
  'error.noVideo': 'Ce fichier ne contient pas de vidéo.',
  'error.cannotDecode': 'Votre navigateur ne sait pas décoder ce format vidéo.',
  'error.cannotEncode': 'Votre navigateur ne sait pas encoder cette vidéo.',
  about: 'À propos',
  aboutText:
    'Masque cache les visages des personnes sur les photos et vidéos de manifestations, pour les partager sans exposer les manifestant·es. Tout se passe dans votre navigateur : vos fichiers ne quittent jamais votre appareil. Masque est un logiciel libre, sous licence AGPL.',
  createdBy: 'Une création de',
  onestlaDescription: 'Collectif de travailleuses et travailleurs du numérique engagé·es dans les luttes sociales.',
  offensiveDescription: 'Organisation municipaliste libertaire à Lille : écologie sociale, féminisme, antifascisme et démocratie directe.',
  credits: 'Crédits',
  creditCenterface: 'modèle de détection des visages',
  creditDeface: 'l’outil en ligne de commande dont Masque s’inspire',
  creditOnnx: 'exécute le modèle dans votre navigateur',
  creditMediabunny: 'décodage et encodage vidéo',
  creditSvelte: 'interface',
  creditFflate: 'archives ZIP',
  creditPlex: 'police de caractères',
}

const messages = { en, fr }

export type Locale = keyof typeof messages
type Messages = typeof en
type Key = keyof Messages
type Args<K extends Key> = Messages[K] extends (...args: infer A) => string ? A : []

const STORAGE_KEY = 'masque.locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in messages) return saved as Locale
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
  return navigator.languages.some((l) => l.startsWith('fr')) ? 'fr' : 'en'
}

export const i18n = $state({ locale: initialLocale() })

document.documentElement.lang = i18n.locale

export function setLocale(locale: Locale) {
  i18n.locale = locale
  document.documentElement.lang = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Not remembered; the browser language applies next time.
  }
}

export function t<K extends Key>(key: K, ...args: Args<K>): string {
  const m = messages[i18n.locale][key] as string | ((...a: Args<K>) => string)
  return typeof m === 'function' ? m(...args) : m
}

/** Errors thrown with a message key (in the worker, for instance) are shown translated. */
export function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.startsWith('error.') && m in en ? t(m as Key & `error.${string}`) : m
}

export const formatNumber = (n: number, digits: number) =>
  n.toLocaleString(i18n.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const formatPercent = (fraction: number) => Math.floor(fraction * 100).toLocaleString(i18n.locale, { style: 'unit', unit: 'percent' })
