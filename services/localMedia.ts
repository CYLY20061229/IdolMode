import { ActionSheetIOS, Alert, Platform } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const CHAT_IMAGE_MAX_EDGE = 1600;
const AVATAR_IMAGE_MAX_EDGE = 640;
const BACKGROUND_IMAGE_MAX_EDGE = 1800;

async function prepareChatImage(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const actions: ImageManipulator.Action[] = [];
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const longEdge = Math.max(width, height);

  if (longEdge > CHAT_IMAGE_MAX_EDGE) {
    if (width >= height) {
      actions.push({ resize: { width: CHAT_IMAGE_MAX_EDGE } });
    } else {
      actions.push({ resize: { height: CHAT_IMAGE_MAX_EDGE } });
    }
  }

  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG
  });

  return result.uri;
}

async function prepareBoundedImage(asset: ImagePicker.ImagePickerAsset, maxEdge: number, compress: number): Promise<string> {
  const actions: ImageManipulator.Action[] = [];
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const longEdge = Math.max(width, height);

  if (longEdge > maxEdge) {
    if (width >= height) {
      actions.push({ resize: { width: maxEdge } });
    } else {
      actions.push({ resize: { height: maxEdge } });
    }
  }

  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress,
    format: ImageManipulator.SaveFormat.JPEG
  });

  return result.uri;
}

async function launchImageLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

async function launchCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function pickLocalImage(): Promise<string | null> {
  return launchImageLibrary();
}

export async function pickProfileAvatarImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("无法选择头像", "请在系统设置中允许访问相册后再试。");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  try {
    return await prepareBoundedImage(result.assets[0], AVATAR_IMAGE_MAX_EDGE, 0.82);
  } catch {
    Alert.alert("头像处理失败", "这张图片暂时无法处理，请换一张试试。");
    return null;
  }
}

export async function pickProfileBackgroundImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("无法选择背景", "请在系统设置中允许访问相册后再试。");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [16, 9],
    quality: 1
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  try {
    return await prepareBoundedImage(result.assets[0], BACKGROUND_IMAGE_MAX_EDGE, 0.84);
  } catch {
    Alert.alert("背景处理失败", "这张图片暂时无法处理，请换一张试试。");
    return null;
  }
}

async function launchChatImageLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("无法选择图片", "请在系统设置中允许访问相册后再试。");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  try {
    return await prepareChatImage(result.assets[0]);
  } catch {
    Alert.alert("图片处理失败", "这张图片暂时无法处理，请换一张试试。");
    return null;
  }
}

async function launchChatCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("无法拍照", "请在系统设置中允许访问相机后再试。");
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  try {
    return await prepareChatImage(result.assets[0]);
  } catch {
    Alert.alert("图片处理失败", "这张图片暂时无法处理，请换一张试试。");
    return null;
  }
}

export async function pickImageForChat(): Promise<string | null> {
  if (Platform.OS === "web") {
    return launchChatImageLibrary();
  }

  if (Platform.OS === "ios") {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions({
        options: ["取消", "拍照", "从相册选择"],
        cancelButtonIndex: 0,
        userInterfaceStyle: "light"
      }, (buttonIndex) => {
        if (buttonIndex === 1) {
          void launchChatCamera().then(resolve);
          return;
        }
        if (buttonIndex === 2) {
          void launchChatImageLibrary().then(resolve);
          return;
        }
        resolve(null);
      });
    });
  }

  return new Promise((resolve) => {
    Alert.alert("发送图片", "选择图片来源", [
      { text: "取消", style: "cancel", onPress: () => resolve(null) },
      { text: "拍照", onPress: () => void launchChatCamera().then(resolve) },
      { text: "从相册选择", onPress: () => void launchChatImageLibrary().then(resolve) }
    ]);
  });
}
