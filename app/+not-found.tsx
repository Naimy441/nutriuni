import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export default function NotFoundScreen() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
      <EmptyState
        icon="compass-outline"
        title="Page not found"
        message="This link doesn't go anywhere in nutriuni."
        actionLabel="Go to Today"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
