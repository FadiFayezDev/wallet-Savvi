import { Alert } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export const confirmAction = (options: ConfirmOptions) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(options.title, options.message ?? '', [
      {
        text: options.cancelText ?? 'Cancel',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmText ?? 'Confirm',
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
