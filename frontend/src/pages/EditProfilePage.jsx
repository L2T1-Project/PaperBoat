import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Cropper from "react-easy-crop";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const getCroppedBlob = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
};

export default function EditProfilePage() {
  const { user } = useAuth();
  const userId = user?.userId;

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");

  const [institutes, setInstitutes] = useState([]);
  const [history, setHistory] = useState([]);
  const [newInstituteId, setNewInstituteId] = useState("");
  const [newFromDate, setNewFromDate] = useState("");
  const [newUptoDate, setNewUptoDate] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState("");
  const [selectedImageName, setSelectedImageName] = useState("profile.jpg");
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const canEditFullName = useMemo(() => profile?.role === "user", [profile?.role]);
  const isResearcher = profile?.role === "researcher";

  const fetchProfile = async () => {
    const response = await api.get("/users/me/profile");
    const data = response.data?.data;
    setProfile(data);
    setFullName(data?.full_name || "");
    setPhoneNumber(data?.phone_number || "");
    setBio(data?.bio || "");
  };

  const fetchResearcherHistory = async () => {
    if (!isResearcher || !userId) return;

    const [institutesRes, historyRes] = await Promise.all([
      api.get("/institutes"),
      api.get(`/researchers/${userId}/institutes`),
    ]);

    setInstitutes(institutesRes.data?.data || []);
    setHistory(historyRes.data?.data || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        setError("");
        await fetchProfile();
      } catch (err) {
        setError(err?.response?.data?.message || err?.response?.data?.error || "Failed to load profile.");
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    fetchResearcherHistory().catch(() => {});
  }, [isResearcher, userId]);

  const onSave = async (event) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        phone_number: phoneNumber.trim() || null,
        bio: bio.trim() || null,
      };

      if (canEditFullName) {
        payload.full_name = fullName.trim();
      }

      const response = await api.patch("/users/me/profile", payload);
      const updated = response.data?.data;
      setProfile(updated);
      setFullName(updated?.full_name || "");
      setPhoneNumber(updated?.phone_number || "");
      setBio(updated?.bio || "");
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const onSelectPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(String(reader.result || ""));
      setSelectedImageName(file.name || "profile.jpg");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const onUploadPhoto = async () => {
    if (!selectedImageSrc || !croppedAreaPixels) return;

    try {
      setIsUploading(true);
      setError("");
      setSuccess("");

      const croppedBlob = await getCroppedBlob(selectedImageSrc, croppedAreaPixels);
      if (!croppedBlob) {
        throw new Error("Could not prepare cropped image");
      }

      const formData = new FormData();
      formData.append("image", croppedBlob, selectedImageName.replace(/\.[^.]+$/, "") + "-cropped.jpg");

      const response = await api.post("/users/me/profile-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updated = response.data?.data;
      setProfile(updated);
      setSuccess("Profile photo updated.");
      setShowCropper(false);
      setSelectedImageSrc("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const addInstituteHistory = async (event) => {
    event.preventDefault();
    if (!newInstituteId || !newFromDate) return;

    try {
      setHistoryBusy(true);
      setError("");
      await api.post(`/researchers/${userId}/institutes`, {
        institute_id: Number(newInstituteId),
        from_date: newFromDate,
        upto_date: newUptoDate || null,
      });

      const historyRes = await api.get(`/researchers/${userId}/institutes`);
      setHistory(historyRes.data?.data || []);
      setNewInstituteId("");
      setNewFromDate("");
      setNewUptoDate("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add institute history.");
    } finally {
      setHistoryBusy(false);
    }
  };

  const removeInstituteHistory = async (entry) => {
    try {
      setHistoryBusy(true);
      setError("");
      await api.delete(`/researchers/${userId}/institutes/${entry.institute_id}`, {
        data: { from_date: entry.from_date },
      });
      const historyRes = await api.get(`/researchers/${userId}/institutes`);
      setHistory(historyRes.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to remove institute history.");
    } finally {
      setHistoryBusy(false);
    }
  };

  if (isLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-600">Loading profile...</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Profile</h1>
            <p className="mt-1 text-sm text-slate-600">Manage your contact info, bio, and profile image.</p>
          </div>
          <Link to="/dashboard" className="text-sm text-slate-600 hover:underline">Back</Link>
        </div>

        {error ? <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

        <div className="mt-6 flex items-center gap-4">
          {profile?.profile_pic_url ? (
            <img src={profile.profile_pic_url} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-slate-200" />
          )}
          <label className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            {isUploading ? "Uploading..." : "Upload Photo"}
            <input type="file" accept="image/*" className="hidden" onChange={onSelectPhoto} disabled={isUploading} />
          </label>
        </div>

        {showCropper ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Adjust photo crop</p>
            <div className="relative h-64 w-full overflow-hidden rounded-lg border border-slate-200 bg-black">
              <Cropper
                image={selectedImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onUploadPhoto}
                disabled={isUploading}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isUploading ? "Uploading..." : "Save Crop"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCropper(false);
                  setSelectedImageSrc("");
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSave}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username (read-only)</label>
            <input value={profile?.username || ""} readOnly className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email (read-only)</label>
            <input value={profile?.email || ""} readOnly className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              readOnly={!canEditFullName}
              className={`w-full rounded-md border px-3 py-2 text-sm ${canEditFullName ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50"}`}
            />
            {!canEditFullName ? (
              <p className="mt-1 text-xs text-slate-500">
                Researchers and venue users cannot edit full name here. Please use the <Link to="/feedback" className="underline">Feedback</Link> page to request changes.
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          {profile?.role === "researcher" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ORCID (read-only)</label>
              <input value={profile?.orc_id || "N/A"} readOnly className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            </div>
          ) : null}

          {profile?.role === "venue_user" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ISSN (read-only)</label>
              <input value={profile?.issn || "N/A"} readOnly className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>

      {isResearcher ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Institute History</h2>
          <p className="mt-1 text-sm text-slate-600">Add your institute affiliations over time.</p>

          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={addInstituteHistory}>
            <select
              value={newInstituteId}
              onChange={(e) => setNewInstituteId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              required
            >
              <option value="">Select Institute</option>
              {institutes.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
            <input type="date" value={newFromDate} onChange={(e) => setNewFromDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            <input type="date" value={newUptoDate} onChange={(e) => setNewUptoDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={historyBusy} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:col-span-4">
              {historyBusy ? "Working..." : "Add Affiliation"}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {!history.length ? (
              <p className="text-sm text-slate-500">No institute history added yet.</p>
            ) : history.map((entry) => (
              <div key={`${entry.institute_id}-${entry.from_date}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{entry.institute_name}</p>
                  <p className="text-xs text-slate-500">{entry.from_date} to {entry.upto_date || "Present"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeInstituteHistory(entry)}
                  disabled={historyBusy}
                  className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
