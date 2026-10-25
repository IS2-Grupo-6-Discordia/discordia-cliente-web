import { View, Text, ScrollView, ActivityIndicator } from "react-native"
import type { ViewStyle } from "react-native"
import type { ServerMember } from "@/api/types"
import ModalShell from "./ModalShell"
import Avatar from "./Avatar"

interface RoleMembersModalProps {
  visible: boolean
  roleName: string
  members: ServerMember[]
  loading?: boolean
  error?: string
  onClose: () => void
}

// HU-8: read-only list of the members that have a given role, so an admin can
// audit who has access to what. The parent (chat.tsx) gates visibility to admins
// and owns the fetch — this component only renders the loaded list, mirroring
// MemberRolesModal. Members come in the same shape and order as the server
// members list, so each row shows the same Avatar + name.
export default function RoleMembersModal({
  visible,
  roleName,
  members,
  loading = false,
  error = "",
  onClose,
}: RoleMembersModalProps) {
  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title={`Miembros con "${roleName || "este rol"}"`}
      subtitle="Estos son los miembros que tienen este rol."
    >
      {error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <ActivityIndicator color="#37D6C0" />
        </View>
      ) : members.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <Text style={{ color: "#5E7E82", fontSize: 13 }}>Ningún miembro tiene este rol.</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 320 }}>
          {members.map((member) => (
            <View key={member.userId} style={MEMBER_ROW}>
              <Avatar initials={member.avatar} size={28} uri={member.avatarUrl} />
              <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "600" }} numberOfLines={1}>
                {member.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </ModalShell>
  )
}

const MEMBER_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  paddingVertical: 10,
  paddingHorizontal: 4,
  borderRadius: 8,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255,255,255,0.08)",
}
const NOTICE_ERROR: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}
