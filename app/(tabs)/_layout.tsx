import { Tabs } from "expo-router";
import TabIcon from "@/components/TabIcon";
import { colors } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 82,
          paddingTop: 10,
          paddingBottom: 18,
          borderTopWidth: 0,
          backgroundColor: colors.card
        }
      }}
    >
      <Tabs.Screen
        name="friends"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "people" : "people-outline"} label="Friends" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "chatbubbles" : "chatbubbles-outline"} label="Chats" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "sparkles" : "sparkles-outline"} label="More" focused={focused} />
        }}
      />
    </Tabs>
  );
}
