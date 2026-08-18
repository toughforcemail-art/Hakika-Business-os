import type { ReactNode, SVGProps, ReactElement } from 'react';

export type LucideIcon = (props: SVGProps<SVGSVGElement> & { size?: number | string }) => ReactElement;

type IconName =
  | 'alert' | 'arrow-left' | 'arrow-right' | 'briefcase' | 'building' | 'check'
  | 'chevron-down' | 'download' | 'edit' | 'eye' | 'mail' | 'minus' | 'plus'
  | 'printer' | 'search' | 'trash' | 'upload' | 'user' | 'user-check' | 'user-plus'
  | 'user-x' | 'x' | 'fallback';

const glyphs: Record<IconName, ReactNode> = {
  alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></>,
  'arrow-left': <><path d="m15 18-6-6 6-6" /><path d="M9 12h12" /></>,
  'arrow-right': <><path d="m9 18 6-6-6-6" /><path d="M3 12h12" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  building: <><path d="M4 21V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v17" /><path d="M2 21h20M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  minus: <path d="M5 12h14" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  printer: <><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  'user-check': <><circle cx="9" cy="7" r="4" /><path d="M1 21a8 8 0 0 1 16 0M16 11l2 2 4-4" /></>,
  'user-plus': <><circle cx="9" cy="7" r="4" /><path d="M1 21a8 8 0 0 1 16 0M19 8v6M16 11h6" /></>,
  'user-x': <><circle cx="9" cy="7" r="4" /><path d="M1 21a8 8 0 0 1 16 0M18 9l5 5M23 9l-5 5" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  fallback: <path d="M5 12h14" />,
};

function makeIcon(iconName: IconName): LucideIcon {
  return ({ size = 24, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {glyphs[iconName]}
    </svg>
  );
}

const icons: Record<string, LucideIcon> = {};
const aliases: Record<string, IconName> = {
  AlertCircle: 'alert', AlertOctagon: 'alert', AlertTriangle: 'alert', CircleAlert: 'alert',
  ArrowLeft: 'arrow-left', ArrowRight: 'arrow-right', Briefcase: 'briefcase', Building: 'building', Building2: 'building',
  Check: 'check', CheckCircle: 'check', CheckCircle2: 'check', ChevronDown: 'chevron-down', Download: 'download',
  Edit: 'edit', Edit2: 'edit', Edit3: 'edit', Pencil: 'edit', PencilLine: 'edit', Eye: 'eye', Mail: 'mail',
  Minus: 'minus', Plus: 'plus', PlusCircle: 'plus', Printer: 'printer', Search: 'search', Trash2: 'trash',
  Upload: 'upload', User: 'user', UserCheck: 'user-check', UserPlus: 'user-plus', UserRound: 'user', UserX: 'user-x', Users: 'user', X: 'x', XCircle: 'x',
  BadgeCheck: 'check', Box: 'building', ChevronUp: 'chevron-down', Expand: 'fallback', Grid2x2: 'fallback',
  Library: 'building', Loader: 'fallback', Maximize2: 'fallback', Minimize2: 'fallback', Move: 'fallback', Navigation: 'fallback',
  Square: 'fallback', Volume2: 'fallback', VolumeX: 'fallback', ZoomIn: 'fallback', ZoomOut: 'fallback',
};
for (const [name, iconName] of Object.entries(aliases)) icons[name] = makeIcon(iconName);
for (const name of `Activity ArrowLeftRight ArrowLeftRight ArrowRightLeft ArrowUpRight ArrowDownRight Award BadgeInfo Banknote BarChart2 BarChart3 Bell BookOpen Boxes Calculator Calendar CalendarClock CalendarDays CalendarPlus Camera CheckCheck CheckSquare ChevronLeft ChevronRight ClipboardCheck ClipboardList Clock Clock3 Command Copy Cpu CreditCard Database DollarSign Droplets ExternalLink FileSignature FileSpreadsheet FileText Filter Gavel Globe GraduationCap GripVertical Grid3x3 Hammer Hash Headphones Heart HeartPulse History Home ImageIcon Image Info KeyRound Landmark Layers3 LayoutDashboard LayoutGrid Link Link2 List Lock LockKeyhole LogIn LogOut Map MapPin MapPinned Megaphone Menu MessageSquare Moon MonitorPlay MoreHorizontal MoreVertical Package PanelLeft Percent Phone PieChart Play QrCode Radio Receipt ReceiptText RefreshCcw RefreshCw RotateCcw Save ScanBarcode Send Server Settings Settings2 Share2 Shield ShieldAlert ShieldCheck ShieldOff ShoppingBag Siren SlidersHorizontal Smartphone Sparkles SquarePlay Star Sun Target Tag TimerReset TrendingDown TrendingUp Undo2 Video Wallet WalletCards Wand2 Wifi WifiOff Workflow Wrench Zap ZapOff`.split(' ')) {
  if (!icons[name]) icons[name] = makeIcon('fallback');
}

export const Icon = makeIcon('fallback');
export const Circle = makeIcon('fallback');
export const Loader2 = makeIcon('fallback');
export const Archive = makeIcon('fallback');
export const FileCheck = makeIcon('fallback');

export const AlertCircle = icons.AlertCircle; export const AlertOctagon = icons.AlertOctagon; export const AlertTriangle = icons.AlertTriangle; export const CircleAlert = icons.CircleAlert;
export const ArrowLeft = icons.ArrowLeft; export const ArrowRight = icons.ArrowRight; export const Briefcase = icons.Briefcase; export const Building = icons.Building; export const Building2 = icons.Building2;
export const Check = icons.Check; export const CheckCircle = icons.CheckCircle; export const CheckCircle2 = icons.CheckCircle2; export const ChevronDown = icons.ChevronDown; export const Download = icons.Download;
export const Edit = icons.Edit; export const Edit2 = icons.Edit2; export const Edit3 = icons.Edit3; export const Pencil = icons.Pencil; export const PencilLine = icons.PencilLine; export const Eye = icons.Eye; export const Mail = icons.Mail; export const Minus = icons.Minus; export const Plus = icons.Plus; export const PlusCircle = icons.PlusCircle; export const Printer = icons.Printer; export const Search = icons.Search; export const Trash2 = icons.Trash2; export const Upload = icons.Upload; export const User = icons.User; export const UserCheck = icons.UserCheck; export const UserPlus = icons.UserPlus; export const UserRound = icons.UserRound; export const UserX = icons.UserX; export const Users = icons.Users; export const X = icons.X; export const XCircle = icons.XCircle;
export const BadgeCheck = icons.BadgeCheck; export const Box = icons.Box; export const ChevronUp = icons.ChevronUp; export const Expand = icons.Expand; export const Grid2x2 = icons.Grid2x2; export const Library = icons.Library; export const Loader = icons.Loader; export const Maximize2 = icons.Maximize2; export const Minimize2 = icons.Minimize2; export const Move = icons.Move; export const Navigation = icons.Navigation; export const Square = icons.Square; export const Volume2 = icons.Volume2; export const VolumeX = icons.VolumeX; export const ZoomIn = icons.ZoomIn; export const ZoomOut = icons.ZoomOut;
export const Activity = icons.Activity; export const ArrowLeftRight = icons.ArrowLeftRight; export const ArrowRightLeft = icons.ArrowRightLeft; export const ArrowUpRight = icons.ArrowUpRight; export const ArrowDownRight = icons.ArrowDownRight; export const Award = icons.Award; export const BadgeInfo = icons.BadgeInfo; export const Banknote = icons.Banknote; export const BarChart2 = icons.BarChart2; export const BarChart3 = icons.BarChart3; export const Bell = icons.Bell; export const BookOpen = icons.BookOpen; export const Boxes = icons.Boxes; export const Calculator = icons.Calculator; export const Calendar = icons.Calendar; export const CalendarClock = icons.CalendarClock; export const CalendarDays = icons.CalendarDays; export const CalendarPlus = icons.CalendarPlus; export const Camera = icons.Camera; export const CheckCheck = icons.CheckCheck; export const CheckSquare = icons.CheckSquare; export const ChevronLeft = icons.ChevronLeft; export const ChevronRight = icons.ChevronRight; export const ClipboardCheck = icons.ClipboardCheck; export const ClipboardList = icons.ClipboardList; export const Clock = icons.Clock; export const Clock3 = icons.Clock3; export const Command = icons.Command; export const Copy = icons.Copy; export const Cpu = icons.Cpu; export const CreditCard = icons.CreditCard; export const Database = icons.Database; export const DollarSign = icons.DollarSign; export const Droplets = icons.Droplets; export const ExternalLink = icons.ExternalLink; export const FileSignature = icons.FileSignature; export const FileSpreadsheet = icons.FileSpreadsheet; export const FileText = icons.FileText; export const Filter = icons.Filter; export const Gavel = icons.Gavel; export const Globe = icons.Globe; export const GraduationCap = icons.GraduationCap; export const GripVertical = icons.GripVertical; export const Grid3x3 = icons.Grid3x3; export const Hammer = icons.Hammer; export const Hash = icons.Hash; export const Headphones = icons.Headphones; export const Heart = icons.Heart; export const HeartPulse = icons.HeartPulse; export const History = icons.History; export const Home = icons.Home; export const ImageIcon = icons.ImageIcon; export const Image = icons.Image; export const Info = icons.Info; export const KeyRound = icons.KeyRound; export const Landmark = icons.Landmark; export const Layers3 = icons.Layers3; export const LayoutDashboard = icons.LayoutDashboard; export const LayoutGrid = icons.LayoutGrid; export const Link = icons.Link; export const Link2 = icons.Link2; export const List = icons.List; export const Lock = icons.Lock; export const LockKeyhole = icons.LockKeyhole; export const LogIn = icons.LogIn; export const LogOut = icons.LogOut; export const Map = icons.Map; export const MapPin = icons.MapPin; export const MapPinned = icons.MapPinned; export const Megaphone = icons.Megaphone; export const Menu = icons.Menu; export const MessageSquare = icons.MessageSquare; export const Moon = icons.Moon; export const MonitorPlay = icons.MonitorPlay; export const MoreHorizontal = icons.MoreHorizontal; export const MoreVertical = icons.MoreVertical; export const Package = icons.Package; export const PanelLeft = icons.PanelLeft; export const Percent = icons.Percent; export const Phone = icons.Phone; export const PieChart = icons.PieChart; export const Play = icons.Play; export const QrCode = icons.QrCode; export const Radio = icons.Radio; export const Receipt = icons.Receipt; export const ReceiptText = icons.ReceiptText; export const RefreshCcw = icons.RefreshCcw; export const RefreshCw = icons.RefreshCw; export const RotateCcw = icons.RotateCcw; export const Save = icons.Save; export const ScanBarcode = icons.ScanBarcode; export const Send = icons.Send; export const Server = icons.Server; export const Settings = icons.Settings; export const Settings2 = icons.Settings2; export const Share2 = icons.Share2; export const Shield = icons.Shield; export const ShieldAlert = icons.ShieldAlert; export const ShieldCheck = icons.ShieldCheck; export const ShieldOff = icons.ShieldOff; export const ShoppingBag = icons.ShoppingBag; export const Siren = icons.Siren; export const SlidersHorizontal = icons.SlidersHorizontal; export const Smartphone = icons.Smartphone; export const Sparkles = icons.Sparkles; export const SquarePlay = icons.SquarePlay; export const Star = icons.Star; export const Sun = icons.Sun; export const Target = icons.Target; export const Tag = icons.Tag; export const TimerReset = icons.TimerReset; export const TrendingDown = icons.TrendingDown; export const TrendingUp = icons.TrendingUp; export const Undo2 = icons.Undo2; export const Video = icons.Video; export const Wallet = icons.Wallet; export const WalletCards = icons.WalletCards; export const Wand2 = icons.Wand2; export const Wifi = icons.Wifi; export const WifiOff = icons.WifiOff; export const Workflow = icons.Workflow; export const Wrench = icons.Wrench; export const Zap = icons.Zap; export const ZapOff = icons.ZapOff;
