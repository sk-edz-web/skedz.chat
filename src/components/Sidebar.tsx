import React, { useState } from "react";
import { motion } from "motion/react";
import { Search, Hash, Shield, Lock, MessageCircle, UserPlus, Users, PlusCircle, ArrowUpRight } from "lucide-react";
import { Room } from "../types";

interface SidebarProps {
  rooms: Room[];
  directChats: Array<{ room: Room; otherUser: { name: string; img: string; contactNo: string } }>;
  publicRooms: Room[];
  currentChatId: string | null;
  onSelectChat: (room: Room) => void;
  onJoinPublicRoom: (room: Room) => void;
  currentUserUid: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rooms,
  directChats,
  publicRooms,
  currentChatId,
  onSelectChat,
  onJoinPublicRoom,
  currentUserUid,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"my-chats" | "communities">("my-chats");

  const filteredMyRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMyDirects = directChats.filter((dc) =>
    dc.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPublicRooms = publicRooms.filter((pr) =>
    pr.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-neutral-200/60 select-none">
      {/* 1. Interactive Search Bar */}
      <div className="p-4 border-b border-neutral-100 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-neutral-100 rounded-full border border-transparent focus:bg-white focus:border-black/10 focus:outline-none text-xs text-[#111827] placeholder-neutral-400 font-medium transition"
            placeholder="Search workspaces or numbers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Dynamic Segmented directory controls */}
        <div className="flex p-0.5 bg-neutral-100/80 rounded-full border border-neutral-200/10">
          <button
            onClick={() => setSidebarTab("my-chats")}
            className={`flex-1 py-1 px-3 text-[10px] font-bold rounded-full cursor-pointer transition flex items-center justify-center gap-1.5 ${
              sidebarTab === "my-chats"
                ? "bg-white text-black shadow-sm"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <MessageCircle className="w-3 h-3" /> Inbox Chats
          </button>
          <button
            onClick={() => setSidebarTab("communities")}
            className={`flex-1 py-1 px-3 text-[10px] font-bold rounded-full cursor-pointer transition flex items-center justify-center gap-1.5 ${
              sidebarTab === "communities"
                ? "bg-white text-black shadow-sm"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Users className="w-3" /> Communities
          </button>
        </div>
      </div>

      {/* 2. Scrolling Directory directory list */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-50 p-2 space-y-1">
        {sidebarTab === "my-chats" ? (
          <>
            {/* Joined Workspaces Header */}
            {filteredMyRooms.length > 0 && (
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                  Workspace Groups ({filteredMyRooms.length})
                </span>
              </div>
            )}
            
            {filteredMyRooms.map((room) => {
              const isSelected = currentChatId === room.id;
              return (
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.99 }}
                  key={room.id}
                  onClick={() => onSelectChat(room)}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/10"
                      : "hover:bg-neutral-50 text-neutral-800"
                  }`}
                >
                  <img
                    src={room.icon || "https://avatar.iran.liara.run/public/61"}
                    alt={room.name}
                    className="w-10 h-10 rounded-2xl object-cover bg-neutral-100 flex-shrink-0"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-extrabold truncate ${isSelected ? "text-white" : "text-neutral-900"}`}>
                        {room.name}
                      </h4>
                      {room.pass && (
                        <Lock className={`w-2.5 h-2.5 ${isSelected ? "text-blue-300" : "text-neutral-400"}`} />
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className={`text-[9px] font-semibold tracking-wide uppercase leading-none ${
                        isSelected ? "text-neutral-300" : "text-neutral-400"
                      }`}>
                        {room.adminId === currentUserUid ? "👑 Creator" : "Member"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Direct Individual Conversations joined list */}
            {filteredMyDirects.length > 0 && (
              <div className="px-3 pt-4 pb-1 border-t border-neutral-100/60">
                <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                  Direct Messages ({filteredMyDirects.length})
                </span>
              </div>
            )}

            {filteredMyDirects.map(({ room, otherUser }) => {
              const isSelected = currentChatId === room.id;
              return (
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.99 }}
                  key={room.id}
                  onClick={() => onSelectChat(room)}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/10"
                      : "hover:bg-neutral-50 text-neutral-800"
                  }`}
                >
                  <img
                    src={otherUser.img || `https://ui-avatars.com/api/?name=${otherUser.name}&background=random`}
                    alt={otherUser.name}
                    className="w-10 h-10 rounded-full object-cover bg-neutral-100 flex-shrink-0"
                  />
                  <div className="flex-1 overflow-hidden">
                    <h4 className={`text-xs font-extrabold truncate ${isSelected ? "text-white" : "text-neutral-900"}`}>
                      {otherUser.name}
                    </h4>
                    <span className={`text-[9px] font-mono leading-none tracking-wide ${
                      isSelected ? "text-neutral-300" : "text-neutral-400"
                    }`}>
                      No: {otherUser.contactNo}
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {filteredMyRooms.length === 0 && filteredMyDirects.length === 0 && (
              <div className="text-center py-12 px-4 select-none">
                <p className="text-xs text-neutral-400 font-semibold mb-1">Your Inbox is quiet</p>
                <p className="text-[10px] text-neutral-400 max-w-[200px] mx-auto leading-relaxed">
                  Start a private direct chat via Dialer/Number or join a Public Community!
                </p>
              </div>
            )}
          </>
        ) : (
          /* Communities Directory Tab List */
          <>
            <div className="px-3 pt-2 pb-1">
              <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                Public Communities
              </span>
            </div>

            {filteredPublicRooms.map((room) => {
              const isSelected = currentChatId === room.id;
              return (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  key={room.id}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-50 transition border border-transparent hover:border-neutral-200/50"
                >
                  <img
                    src={room.icon || "https://avatar.iran.liara.run/public/61"}
                    alt={room.name}
                    className="w-10 h-10 rounded-2xl object-cover bg-neutral-100 flex-shrink-0"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold truncate text-neutral-900">
                        {room.name}
                      </h4>
                      {room.pass && (
                        <Lock className="w-2.5 h-2.5 text-neutral-400" />
                      )}
                    </div>
                    <span className="text-[9px] font-semibold text-neutral-450 truncate block mt-0.5">
                      Click to unlock & join community
                    </span>
                  </div>
                  <button
                    onClick={() => onJoinPublicRoom(room)}
                    className="py-1 px-3 bg-neutral-100 hover:bg-black hover:text-white border border-neutral-200/60 rounded-full text-[10px] font-bold transition flex items-center gap-0.5 flex-shrink-0 cursor-pointer"
                  >
                    Join <ArrowUpRight className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })}

            {filteredPublicRooms.length === 0 && (
              <div className="text-center py-12 px-4 select-none">
                <p className="text-xs text-neutral-400 font-semibold">No other public groups</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Create your own public community to invite users!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
