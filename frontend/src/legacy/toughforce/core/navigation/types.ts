// @ts-nocheck
export interface NavigationItem {
  id: string;
  title: string;
  iconKey: string;
  route: string;
  applicationId: string;
  requiredPermissions: readonly string[];
  requiredSubscription: string | null;
  visible: boolean;
  enabled: boolean;
  badge: string | number | null;
  children: readonly NavigationItem[];
  order: number;
}
