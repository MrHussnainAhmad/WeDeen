import { TabLoadingPlaceholder } from '@/components/loading/TabLoadingPlaceholder';

/** Borderless Home loading — no shimmer boxes that flash during tab transitions. */
export function HomeSkeleton(_props: { topPad: number }) {
  return <TabLoadingPlaceholder spinner />;
}
