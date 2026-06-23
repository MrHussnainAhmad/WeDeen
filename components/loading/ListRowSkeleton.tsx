import { TabLoadingPlaceholder } from '@/components/loading/TabLoadingPlaceholder';

type Props = {
  rows?: number;
  rowHeight?: number;
  paddingTop?: number;
};

/** @deprecated Use TabLoadingPlaceholder — kept for call-site compatibility. */
export function ListRowSkeleton(_props: Props) {
  return <TabLoadingPlaceholder />;
}
