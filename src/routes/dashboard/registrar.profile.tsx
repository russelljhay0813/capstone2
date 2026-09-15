import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/registrar/profile")({
  component: RegistrarProfile,
});

function RegistrarProfile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = () => {
    toast.success("Profile updated");
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      return toast.error("Please fill in both password fields");
    }
    toast.success("Password changed successfully");
    setCurrentPassword("");
    setNewPassword("");
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Registrar Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  className="h-24 w-24 rounded-full object-cover border-2 border-accent"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/10 text-2xl font-bold text-accent">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              )}
              <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
            <h2 className="mt-3 font-heading text-base font-bold text-foreground">{user.name}</h2>
            <p className="text-xs text-muted-foreground">Registrar Office</p>
            <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm sm:col-span-2 space-y-6">
          <div>
            <h3 className="font-heading text-sm font-semibold text-foreground mb-4">
              Edit Profile Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Registrar ID</Label>
                <Input value={user.userId || user.studentId || user.id} disabled className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Office Assignment</Label>
                <Input value="Registrar Office" disabled className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleUpdateProfile}>Update Profile</Button>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-heading text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4" /> Change Password
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleChangePassword} variant="outline">
                Change Password
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}