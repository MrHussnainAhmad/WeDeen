import { Stack, useLocalSearchParams } from 'expo-router';
import { HadithList } from '@/components/hadith/HadithList';

export default function HadithSectionScreen() {
  const { book, section, title } = useLocalSearchParams<{ book: string; section: string; title?: string }>();

  return (
    <>
      <Stack.Screen options={{ title: title || 'Hadith' }} />
      <HadithList slug={book} section={section} />
    </>
  );
}
