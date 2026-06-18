import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, Send, Trash2, Shield, ArrowLeft, MessageSquare, CheckCircle } from "lucide-react";
import { db } from "../config/firebase";
import { ref, push, get, remove, set } from "firebase/database";
import { Feedback } from "../types";

interface FeedbacksProps {
  currentUserId: string;
  userEmail: string;
  userName: string;
  isAdmin: boolean;
  onBackToHome: () => void;
  userContactNo: string;
}

export const Feedbacks: React.FC<FeedbacksProps> = ({
  currentUserId,
  userEmail,
  userName,
  isAdmin,
  onBackToHome,
  userContactNo,
}) => {
  const [name, setName] = useState<string>(userName || "");
  const [email, setEmail] = useState<string>(userEmail || "");
  const [text, setText] = useState<string>("");
  const [rating, setRating] = useState<number>(5);
  const [submissionType, setSubmissionType] = useState<'feedback' | 'bug'>('feedback');
  const [adminReviews, setAdminReviews] = useState<Feedback[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // For Admin reply modal
  const [selectedReplyFb, setSelectedReplyFb] = useState<Feedback | null>(null);
  const [replyMessage, setReplyMessage] = useState<string>("");
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  // Sync inputs with user details if they change
  useEffect(() => {
    setName(userName);
    setEmail(userEmail);
  }, [userName, userEmail]);

  // Load reviews for admin portal
  const fetchReviews = async () => {
    setIsLoadingReviews(true);
    try {
      const snap = await get(ref(db, "feedbacks"));
      if (snap.exists()) {
        const list: Feedback[] = [];
        snap.forEach((child) => {
          list.push({ id: child.key as string, ...child.val() });
        });
        // Sort descending by timestamp
        list.reverse();
        setAdminReviews(list);
      } else {
        setAdminReviews([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchReviews();
    }
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return alert("Message body cannot be empty!");

    try {
      await push(ref(db, "feedbacks"), {
        uid: currentUserId,
        name,
        email,
        rating: submissionType === 'feedback' ? rating : 0,
        text,
        type: submissionType,
        contactNo: userContactNo,
        timestamp: Date.now(),
      });
      setIsSubmitted(true);
      setText("");
      // Refresh list if admin is filling
      if (isAdmin) {
        fetchReviews();
      }
    } catch (err: any) {
      alert("Error submitting: " + err.message);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (confirm("Are you sure you want to delete this feedback?")) {
      try {
        await remove(ref(db, `feedbacks/${id}`));
        setAdminReviews((prev) => prev.filter((r) => r.id !== id));
      } catch (err: any) {
        alert("Error deleting feedback: " + err.message);
      }
    }
  };

  const handleOpenReplyModal = (fb: Feedback) => {
    if (!fb.uid || fb.uid === "anonymous") {
      return alert("Cannot reply to anonymous or empty user references!");
    }
    setSelectedReplyFb(fb);
    setReplyMessage("");
  };

  const handleSendReply = async () => {
    if (!selectedReplyFb) return;
    if (!replyMessage.trim()) return alert("Reply message is empty!");

    setIsSendingReply(true);
    const targetUid = selectedReplyFb.uid;
    const roomId = `REPLY_${targetUid}`;

    try {
      // Create a private support conversation
      const roomData = {
        id: roomId,
        name: "Admin Feedback Reply",
        icon: "https://avatar.iran.liara.run/public/61", // Sleek technical/support workspace logo
        type: "private",
        adminId: "ADMIN",
        users: {
          [targetUid]: true,
          ADMIN: true,
        },
      };

      // Set room parameters in DB
      await set(ref(db, `rooms/${roomId}`), roomData);
      await set(ref(db, `room_members/${roomId}/${targetUid}`), { role: "member" });
      await set(ref(db, `user_chats/${targetUid}/${roomId}`), { joinedAt: Date.now() });

      // Append default support message
      const msgRef = push(ref(db, `messages/${roomId}`));
      await set(msgRef, {
        text: replyMessage.trim(),
        type: "text",
        senderId: "ADMIN",
        senderName: "Support Team",
        senderImg: "https://ui-avatars.com/api/?name=Admin&background=000&color=fff",
        timestamp: Date.now(),
      });

      alert(`Reply has been successfully delivered to user's chat!`);
      setSelectedReplyFb(null);
    } catch (e: any) {
      alert("Error delivering reply: " + e.message);
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full py-2">
      {/* Back Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBackToHome}
          className="p-2 bg-white border border-neutral-200/50 rounded-xl hover:border-black/10 text-neutral-600 transition shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#111827]">
            App Workspace Feedback
          </h2>
          <p className="text-xs text-neutral-400">Share suggestions or manage user feedback.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-yellow-600 font-semibold text-xs relative overflow-hidden">
          <Shield className="w-4 h-4 text-yellow-600" />
          ADMINISTRATOR CONTROL ACTIVATED — PORTAL ONLINE
        </div>
      )}

      {/* Admin Review List Tab / Standard review toggle */}
      {isAdmin ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-neutral-200/50 shadow-sm">
            <h3 className="font-bold text-neutral-800 text-sm flex items-center gap-1.5">
              <span>📋</span> Incoming Reviews
            </h3>
            <button
              onClick={fetchReviews}
              className="text-xs text-blue-500 hover:underline font-bold cursor-pointer"
            >
              Refresh Logs
            </button>
          </div>

          <div className="space-y-3">
            {isLoadingReviews ? (
              <p className="text-center text-xs text-neutral-400 py-10">Syncing reviews... 📡</p>
            ) : adminReviews.length === 0 ? (
              <div className="text-center bg-white/60 p-10 border border-dashed border-neutral-200 rounded-3xl text-sm text-neutral-400 select-none">
                No user logs found. Database clean.
              </div>
            ) : (
              adminReviews.map((fb) => (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={fb.id}
                  className="bg-white rounded-3xl p-5 border border-neutral-200/50 shadow-sm transition hover:shadow-md flex flex-col gap-3 relative"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-[#111827] text-sm leading-tight flex items-center gap-2">
                        {fb.name}
                        {fb.type === 'bug' ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[9px] font-extrabold uppercase">BUG</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[9px] font-extrabold uppercase">FEEDBACK</span>
                        )}
                      </h4>
                      <div className="flex flex-col text-[10px] text-neutral-400 gap-0.5 mt-0.5">
                        <span>Email: {fb.email}</span>
                        {fb.contactNo && (
                          <span className="font-mono text-emerald-600 font-bold">Secret No: {fb.contactNo}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-0.5 text-yellow-400">
                      {fb.type !== 'bug' && Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`w-3.5 h-3.5 fill-current ${
                            idx < fb.rating ? "text-yellow-400" : "text-neutral-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs italic bg-neutral-50 p-3 rounded-2xl text-neutral-700 leading-relaxed border-l-2 border-neutral-300">
                    "{fb.text}"
                  </p>

                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[9px] text-neutral-400 font-mono">
                      {new Date(fb.timestamp).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteFeedback(fb.id as string)}
                        className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200/70 text-red-500 transition cursor-pointer"
                        title="Delete Feedback"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenReplyModal(fb)}
                        className="py-1 px-3 bg-black hover:bg-neutral-900 border border-black text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" /> Reply Room
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* User Feedback Form */
        <div className="bg-white rounded-[28px] border border-neutral-200/50 shadow-sm p-6 md:p-8">
          <AnimatePresence mode="wait">
            {isSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8 flex flex-col items-center gap-4"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-950">Review Recorded Successfully</h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                    Thank you, your secure app feedback has been registered and transmitted to developers.
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsSubmitted(false)}
                  className="mt-4 px-5 py-2.5 bg-neutral-900 hover:bg-[#111] text-white text-xs font-semibold rounded-xl cursor-pointer transition shadow-sm"
                >
                  Submit Another review
                </motion.button>
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-800">Your Full Name</label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-neutral-50/50"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Display Name"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-neutral-800">Email Reference</label>
                    <input
                      type="email"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-neutral-50/50"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="mail@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-800">Submission Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSubmissionType('feedback')}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                        submissionType === 'feedback'
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      💡 General Feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmissionType('bug')}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                        submissionType === 'bug'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      🪲 Report a Bug
                    </button>
                  </div>
                </div>

                {submissionType === 'feedback' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-neutral-800">Select App Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setRating(star)}
                          className="p-1 hover:scale-110 transition cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= rating
                                ? "text-yellow-400 fill-current"
                                : "text-neutral-300 fill-none"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-800">
                    {submissionType === 'bug' ? 'Describe the Bug' : 'Your Review / Suggestions'}
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-neutral-50/50 resize-y"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={submissionType === 'bug' ? "Describe the bug in detail: what happened, what was expected, and steps to reproduce..." : "Provide detailed feedback on security, performance, or calling interfaces..."}
                    required
                  />
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 bg-[#0a0a0a] border border-[#0a0a0a] hover:bg-[#151515] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-neutral-200 cursor-pointer transition-colors mt-2"
                >
                  <Send className="w-3.5 h-3.5" /> {submissionType === 'bug' ? 'Submit Bug Report Securely' : 'Submit Feedback Securely'}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Admin Reply Modal Overlay */}
      <AnimatePresence>
        {selectedReplyFb && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-neutral-100 max-w-sm w-full p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-150">
                <h4 className="font-bold text-sm text-[#111827]">
                  Send Support Room Message
                </h4>
                <button
                  onClick={() => setSelectedReplyFb(null)}
                  className="text-xs text-neutral-400 hover:text-black font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <p className="text-[11px] text-neutral-400 uppercase tracking-widest font-semibold mb-2">
                Replying to {selectedReplyFb.name}
              </p>
              <div className="text-xs text-neutral-500 italic p-3 bg-neutral-50 rounded-xl mb-4 line-clamp-2 overflow-hidden border-l-2 border-neutral-300">
                "{selectedReplyFb.text}"
              </div>

              <textarea
                rows={4}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type the message that will be initialized as a secure direct support room back to the user..."
                className="w-full p-3 text-xs border border-neutral-250 rounded-xl resize-none outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-neutral-400"
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setSelectedReplyFb(null)}
                  className="py-2 px-4 rounded-xl border border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                  disabled={isSendingReply}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={isSendingReply}
                  className="py-2 px-5 bg-blue-500 hover:bg-blue-600 rounded-xl border border-blue-500 text-xs text-white font-bold cursor-pointer transition flex items-center gap-1.5"
                >
                  {isSendingReply ? "Delivering..." : "Deliver Message"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
