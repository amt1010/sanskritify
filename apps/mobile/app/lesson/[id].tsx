import { useLocalSearchParams } from 'expo-router';
import { LessonScreen } from '../../src/screens/LessonScreen';

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LessonScreen lessonId={id} />;
}
