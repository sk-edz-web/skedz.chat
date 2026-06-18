import React, { useState } from "react";
import { motion } from "motion/react";
import { Phone, Video, MessageSquare, Delete } from "lucide-react";

interface DialerProps {
  onDialAction: (number: string, action: "audio" | "video" | "chat") => void;
}

export const Dialer: React.FC<DialerProps> = ({ onDialAction }) => {
  const [dialedNumber, setDialedNumber] = useState<string>("");

  const pressKey = (char: string) => {
    if (dialedNumber.length < 12) {
      setDialedNumber((prev) => prev + char);
      // Play a clean tactile synthetic sound effect (audio contextualization)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.frequency.setValueAtTime(char === "0" ? 941 : char === "*" || char === "#" ? 697 : 1209, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } catch (e) {
        // Fallback silently if audio context is blocked
      }
    }
  };

  const pressBackspace = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleAction = (actionType: "audio" | "video" | "chat") => {
    if (dialedNumber.length !== 12) {
      alert("Please enter a clean 12-digit identity contact number.");
      return;
    }
    onDialAction(dialedNumber, actionType);
  };

  const keys = [
    { num: "1", letters: "" },
    { num: "2", letters: "ABC" },
    { num: "3", letters: "DEF" },
    { num: "4", letters: "GHI" },
    { num: "5", letters: "JKL" },
    { num: "6", letters: "MNO" },
    { num: "7", letters: "PQRS" },
    { num: "8", letters: "TUV" },
    { num: "9", letters: "WXYZ" },
    { num: "*", letters: "" },
    { num: "0", letters: "+" },
    { num: "#", letters: "" },
  ];

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center py-6">
      {/* High-fidelity dial display */}
      <div className="w-full text-center mb-8 h-20 flex flex-col justify-end">
        <h1 className="text-4xl font-extrabold tracking-widest text-[#000000] font-mono select-none drop-shadow-sm min-h-[40px]">
          {dialedNumber || " "}
        </h1>
        {dialedNumber && (
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mt-1">
            Ready to secure
          </span>
        )}
      </div>

      {/* Grid dialpad */}
      <div className="grid grid-cols-3 gap-y-4 gap-x-6 justify-items-center mb-8 w-full max-w-[290px]">
        {keys.map((key) => (
          <motion.button
            whileTap={{ scale: 0.88 }}
            key={key.num}
            onClick={() => pressKey(key.num)}
            className="w-16 h-16 rounded-full bg-white/70 backdrop-blur-md border border-neutral-200/50 flex flex-col items-center justify-center text-[#111827] cursor-pointer shadow-sm hover:border-black/10 transition-colors"
          >
            <span className="text-2xl font-bold select-none">{key.num}</span>
            {key.letters && (
              <span className="text-[9px] font-bold text-neutral-400 tracking-wider -mt-1 select-none">
                {key.letters}
              </span>
            )}
          </motion.button>
        ))}

        {/* Backspace utility placed beautifully below pad */}
        <div />
        <div />
        {dialedNumber && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={pressBackspace}
            className="w-16 h-16 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-rose-500 cursor-pointer shadow-sm transition-colors"
            title="Backspace"
          >
            <Delete className="w-5 h-5" />
          </motion.button>
        )}
      </div>

      {/* Action triggers */}
      <div className="flex justify-around items-center gap-6 w-full max-w-[270px]">
        {/* Voice Calling */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => handleAction("audio")}
          className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white cursor-pointer shadow-md shadow-emerald-500/10 active:shadow-none transition-all"
          title="Direct Secure Voice Call"
        >
          <Phone className="w-5 h-5 fill-current" />
        </motion.button>

        {/* Direct Text Chatting */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => handleAction("chat")}
          className="w-14 h-14 rounded-full bg-black hover:bg-neutral-900 flex items-center justify-center text-white cursor-pointer shadow-md shadow-black/10 active:shadow-none transition-all"
          title="Start Text Room"
        >
          <MessageSquare className="w-5 h-5 fill-current" />
        </motion.button>

        {/* Video Calling */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => handleAction("video")}
          className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white cursor-pointer shadow-md shadow-blue-500/10 active:shadow-none transition-all"
          title="Direct Secure Video Call"
        >
          <Video className="w-5 h-5 fill-current" />
        </motion.button>
      </div>
    </div>
  );
};
