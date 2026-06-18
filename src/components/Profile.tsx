import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  User, Image as ImageIcon, Copy, Shield, LogOut, Check, Sliders, 
  RefreshCw, Key, Lock, Unlock, Upload, Loader, Mail, Phone, Link2, Info 
} from "lucide-react";
import { UserProfile } from "../types";
import { uploadToCloudinary, isCloudinaryConfigured } from "../utils/cloudinary";

interface ProfileProps {
  currentProfile: UserProfile;
  onSaveProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onSignOut: () => void;
  isAdmin: boolean;
  onToggleAdmin: () => void;
}

export const Profile: React.FC<ProfileProps> = ({
  currentProfile,
  onSaveProfile,
  onSignOut,
  isAdmin,
  onToggleAdmin,
}) => {
  const [name, setName] = useState<string>(currentProfile.name || "");
  const [img, setImg] = useState<string>(currentProfile.img || "");
  const [bio, setBio] = useState<string>(currentProfile.bio || "");
  const [mail, setMail] = useState<string>(currentProfile.mail || "");
  const [mobile, setMobile] = useState<string>(currentProfile.mobile || "");
  const [links, setLinks] = useState<string>(currentProfile.links || "");

  const [namePublic, setNamePublic] = useState<boolean>(currentProfile.namePublic !== false);
  const [bioPublic, setBioPublic] = useState<boolean>(currentProfile.bioPublic !== false);
  const [mailPublic, setMailPublic] = useState<boolean>(currentProfile.mailPublic !== false);
  const [mobilePublic, setMobilePublic] = useState<boolean>(currentProfile.mobilePublic === true);
  const [linksPublic, setLinksPublic] = useState<boolean>(currentProfile.linksPublic === true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const [cloudinaryCloudName, setCloudinaryCloudName] = useState<string>("");
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState<string>("");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);

  useEffect(() => {
    setCloudinaryCloudName(localStorage.getItem('cloudinary_cloud_name') || "");
    setCloudinaryUploadPreset(localStorage.getItem('cloudinary_upload_preset') || "");
  }, []);

  const handleSaveCloudinary = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('cloudinary_cloud_name', cloudinaryCloudName.trim());
    localStorage.setItem('cloudinary_upload_preset', cloudinaryUploadPreset.trim());
    alert("Cloudinary upload configurations saved successfully!");
  };

  useEffect(() => {
    setName(currentProfile.name || "");
    setImg(currentProfile.img || "");
    setBio(currentProfile.bio || "");
    setMail(currentProfile.mail || "");
    setMobile(currentProfile.mobile || "");
    setLinks(currentProfile.links || "");
    setNamePublic(currentProfile.namePublic !== false);
    setBioPublic(currentProfile.bioPublic !== false);
    setMailPublic(currentProfile.mailPublic !== false);
    setMobilePublic(currentProfile.mobilePublic === true);
    setLinksPublic(currentProfile.linksPublic === true);
  }, [currentProfile]);



  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveProfile({
        name: name.trim(),
        img: img.trim(),
        bio: bio.trim(),
        mail: mail.trim(),
        mobile: mobile.trim(),
        links: links.trim(),
        namePublic,
        bioPublic,
        mailPublic,
        mobilePublic,
        linksPublic,
      });
      alert("Identity values successfully saved!");
    } catch (e: any) {
      alert("Error saving profile: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyContactNo = () => {
    if (currentProfile.contactNo) {
      navigator.clipboard.writeText(currentProfile.contactNo).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };



  const handleAvatarUploadClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isCloudinaryConfigured()) {
      alert("Image uploads are currently unavailable. Contact the administrator.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const url = await uploadToCloudinary(file);
      setImg(url);
      await onSaveProfile({ img: url });
      alert("Avatar successfully uploaded and updated!");
    } catch (err: any) {
      alert("Failed to upload avatar image: " + err.message);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const generateRandomAvatar = () => {
    const seed = Math.floor(Math.random() * 100);
    const randomImgUrl = `https://avatar.iran.liara.run/public/${seed}`;
    setImg(randomImgUrl);
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 pb-24">
      {/* 1. Header Profile Avatar */}
      <div className="bg-white rounded-[32px] p-6 border border-neutral-200/50 shadow-sm text-center relative overflow-hidden flex flex-col items-center">
        {/* Subtle decorative background gradient */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neutral-50/50 to-transparent pointer-events-none" />

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFileChange}
        />

        <div className="relative mb-4 group mt-2">
          <div 
            onClick={handleAvatarUploadClick}
            className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-neutral-100 cursor-pointer overflow-hidden z-10"
            title="Click to Upload Profile Photo"
          >
            <img
              src={img || `https://ui-avatars.com/api/?name=${name || "User"}&background=000&color=fff`}
              alt="Profile Preview"
              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
            />
            {/* Quick Upload Hover overlay */}
            <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition duration-200">
              {isUploadingAvatar ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Upload className="w-4 h-4 mb-0.5" />
                  <span className="text-[8px] font-black uppercase tracking-wider">Upload</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              generateRandomAvatar();
            }}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-black text-white hover:bg-neutral-900 border border-neutral-200 flex items-center justify-center shadow z-20 cursor-pointer transition active:scale-90"
            title="Randomize Avatar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <h2 className="text-lg font-black tracking-tight text-neutral-950 mb-0.5">
          {currentProfile.name || "App Member"}
        </h2>

        {/* Contact Selector */}
        <div className="flex items-center gap-2 mt-2 bg-neutral-100/80 px-4 py-2 border border-neutral-200/50 rounded-full select-none cursor-pointer hover:bg-neutral-150 transition active:scale-95" onClick={copyContactNo}>
          <span className="text-xs font-mono font-black text-neutral-500 uppercase tracking-widest leading-none">
            No: {currentProfile.contactNo || "..."}
          </span>
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-neutral-400" />
          )}
        </div>
      </div>

      {/* 2. Update Profile Values */}
      <div className="bg-white rounded-[28px] border border-neutral-200/50 shadow-sm p-6">
        <h3 className="font-bold text-[#111] text-xs flex items-center gap-1.5 border-b border-neutral-100 pb-3 mb-4">
          <User className="w-4 h-4 text-blue-500" /> Profile Configurations
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          {/* Your Display Name */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800">Your Display Name</label>
              <button
                type="button"
                onClick={() => setNamePublic((p) => !p)}
                className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-1 cursor-pointer select-none border border-neutral-200 rounded px-1.5 py-0.5"
              >
                {namePublic ? (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-500" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-neutral-400" /> Private
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarathi"
              required
            />
          </div>

          {/* Email address */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800">Email Address</label>
              <button
                type="button"
                onClick={() => setMailPublic((p) => !p)}
                className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-1 cursor-pointer select-none border border-neutral-200 rounded px-1.5 py-0.5"
              >
                {mailPublic ? (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-500" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-neutral-400" /> Private
                  </>
                )}
              </button>
            </div>
            <input
              type="email"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              placeholder="mail@securedomain.org"
            />
          </div>

          {/* Mobile number */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800">Mobile Number</label>
              <button
                type="button"
                onClick={() => setMobilePublic((p) => !p)}
                className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-1 cursor-pointer select-none border border-neutral-200 rounded px-1.5 py-0.5"
              >
                {mobilePublic ? (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-500" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-neutral-400" /> Private
                  </>
                )}
              </button>
            </div>
            <input
              type="tel"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>

          {/* Custom Web Links */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800">General Web Links</label>
              <button
                type="button"
                onClick={() => setLinksPublic((p) => !p)}
                className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-1 cursor-pointer select-none border border-neutral-200 rounded px-1.5 py-0.5"
              >
                {linksPublic ? (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-500" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-neutral-400" /> Private
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="e.g. github.com/sarathi"
            />
          </div>

          {/* Profile bio */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800">General Bio / Status</label>
              <button
                type="button"
                onClick={() => setBioPublic((p) => !p)}
                className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-1 cursor-pointer select-none border border-neutral-200 rounded px-1.5 py-0.5"
              >
                {bioPublic ? (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-500" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-neutral-400" /> Private
                  </>
                )}
              </button>
            </div>
            <textarea
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50 h-20 resize-none"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other contact channels about yourself..."
            />
          </div>

          {/* Image URL input (integrated) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-800">Profile Image URL</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
              value={img}
              onChange={(e) => setImg(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              required
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 bg-neutral-900 border border-neutral-900 hover:bg-neutral-950 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer transition-all"
          >
            {isSaving ? "Saving Profiles..." : "Save Profile Values"}
          </motion.button>
        </form>
      </div>



      {/* 4. Cloudinary Configuration Section */}
      <div className="bg-white rounded-[28px] border border-neutral-200/50 shadow-sm p-6">
        <h3 className="font-bold text-[#111] text-xs flex items-center gap-1.5 border-b border-neutral-100 pb-3 mb-4">
          <ImageIcon className="w-4 h-4 text-emerald-500" /> Cloudinary Media Storage
        </h3>
        
        <div className="mb-4 text-[10px] text-neutral-500 leading-relaxed bg-neutral-50 p-3.5 rounded-2xl border border-neutral-150">
          Provide your Cloudinary client credentials if you wish to host files on Cloudinary. 
          <strong> Note:</strong> If left empty, a seamless compression-optimized offline Base64 string fallback is automatically activated so image uploads work instantly!
        </div>

        <form onSubmit={handleSaveCloudinary} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-800">Cloud Name</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-neutral-50/50"
              value={cloudinaryCloudName}
              onChange={(e) => setCloudinaryCloudName(e.target.value)}
              placeholder="e.g. dxyz1234"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-800">Unsigned Upload Preset</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-neutral-50/50"
              value={cloudinaryUploadPreset}
              onChange={(e) => setCloudinaryUploadPreset(e.target.value)}
              placeholder="e.g. chat_unsigned_preset"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-950 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer transition-all"
          >
            Save Cloudinary Credentials
          </motion.button>
        </form>
      </div>



      {/* 5. Personal System Sign Out */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onSignOut}
        className="w-full py-3 bg-red-500 hover:bg-red-650 border border-red-500 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-rose-250 cursor-pointer transition-colors"
      >
        <LogOut className="w-4 h-4" /> Sign Out App Session
      </motion.button>
    </div>
  );
};
