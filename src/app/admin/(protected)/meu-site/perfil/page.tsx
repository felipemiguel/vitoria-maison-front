import { requirePagePermission } from "@/features/access/server";
import { loadMySite } from "@/features/brokers/my-site";
import { mediaPath } from "@/features/media/media-url";
import { BrokerProfileForm } from "@/components/admin/brokers/broker-forms";
import { PhotoUpload } from "@/components/admin/brokers/photo-upload";

export const metadata = { title: "Perfil profissional" };

export default async function MyProfilePage() {
  const user = await requirePagePermission("broker-profile:read-own");
  const { profile } = await loadMySite(user);
  const card = "rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6";
  return <div className="space-y-6">
    {profile && <section className={card}><h3 className="font-semibold">Foto profissional</h3><div className="mt-4"><PhotoUpload name={profile.displayName} currentUrl={profile.profileImageAssetId ? mediaPath(profile.profileImageAssetId) : profile.profileImageUrl}/></div></section>}
    <section className={card}><h3 className="font-semibold">Dados profissionais</h3><p className="mt-1 text-sm text-[#746c67]">Informações exibidas no seu site. O CRECI é conferido pela equipe antes de aparecer publicamente.</p>
      <div className="mt-5"><BrokerProfileForm defaultName={user.name} profile={profile ? { displayName: profile.displayName, professionalTitle: profile.professionalTitle, biography: profile.biography, whatsapp: profile.whatsapp, phone: profile.phone, emailPublic: profile.emailPublic, creci: profile.creci, specialties: profile.specialties, serviceRegions: profile.serviceRegions, creciVerified: Boolean(profile.creciVerifiedAt) } : null}/></div></section>
  </div>;
}
