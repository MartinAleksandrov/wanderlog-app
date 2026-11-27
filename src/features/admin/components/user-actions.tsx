import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showError } from '@/lib/error-message';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { ShieldBanIcon, Trash2Icon, UserCheckIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';

type ActionUser = {
  _id: Id<'users'>;
  role: 'admin' | 'user';
  suspended: boolean;
  isYou: boolean;
};

// What an admin can do to an account: Suspend (or Restore), and Delete data. The backend checks
// all of it again (convex/admin.ts); the buttons only leave out what it would refuse anyway.
// The page is a live query, so after each action the status, badges and trips change by
// themselves, here and on the dashboard.
export function UserActions({ user, name }: { user: ActionUser; name: string }) {
  const suspend = useMutation(api.admin.suspendUser);
  const restore = useMutation(api.admin.restoreUser);
  const deleteData = useMutation(api.admin.deleteUserData);
  // One action at a time: no double taps while the server answers
  const [isBusy, setIsBusy] = useState(false);

  if (user.isYou) {
    return <Text variant="muted">{"This is your account. Admins can't suspend themselves."}</Text>;
  }
  if (user.role === 'admin') {
    return (
      <Text variant="muted">
        {"Admins can't be suspended. Make them a user in the Convex dashboard first."}
      </Text>
    );
  }

  function run(action: Promise<unknown>, failure: string) {
    setIsBusy(true);
    action.catch((error: unknown) => showError(failure, error)).finally(() => setIsBusy(false));
  }

  function confirmSuspend() {
    Alert.alert(
      `Suspend ${name}?`,
      "They can't use Wandr until you restore their access. Their trips are kept.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: () => run(suspend({ userId: user._id }), "Couldn't suspend the account"),
        },
      ],
    );
  }

  function confirmDeleteData() {
    Alert.alert(
      `Delete ${name}'s data?`,
      "Their trips, with every place, plan and booking in them, and their phones and request counts are deleted for good, and the account is suspended. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => run(deleteData({ userId: user._id }), "Couldn't delete the data"),
        },
      ],
    );
  }

  return (
    <View className="gap-3">
      {user.suspended ? (
        // Not destructive, so no question first
        <Button
          variant="outline"
          disabled={isBusy}
          onPress={() => run(restore({ userId: user._id }), "Couldn't restore the account")}
        >
          <Icon as={UserCheckIcon} />
          <Text>Restore access</Text>
        </Button>
      ) : (
        <Button variant="outline" disabled={isBusy} onPress={confirmSuspend}>
          <Icon as={ShieldBanIcon} />
          <Text>Suspend</Text>
        </Button>
      )}
      <Button variant="destructive" disabled={isBusy} onPress={confirmDeleteData}>
        <Icon as={Trash2Icon} />
        <Text>Delete data</Text>
      </Button>
      <Text variant="muted">
        Suspend blocks the app for them and keeps their trips; Restore access undoes it. Delete data
        also deletes their trips for good.
      </Text>
    </View>
  );
}
