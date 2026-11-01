import {NextResponse} from "next/server";
import {admin,userFrom} from "../../paypal/_shared";
export const runtime="nodejs";
export async function POST(request:Request){
 const user=await userFrom(request);if(!user)return NextResponse.json({error:"Connexion requise"},{status:401});
 try{
 const body=await request.json();const id=typeof body?.documentId==="string"?body.documentId:"";
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Document invalide"},{status:400});
 const db=admin();const {data:doc,error}=await db.from("documents").select("id,document_number,document_type,client_name,client_email,client_phone").eq("id",id).eq("user_id",user.id).maybeSingle();
 if(error||!doc)return NextResponse.json({error:"Document introuvable"},{status:404});
 const channel=body?.channel==="sms"?"sms":body?.channel==="email"?"email":"whatsapp";
 const number=String(doc.document_number||"").slice(0,80);const message="Bonjour "+String(doc.client_name||"").slice(0,120)+", votre "+(doc.document_type==="facture"?"facture":"devis")+" "+number+" est prêt. Contactez-nous pour recevoir le PDF en toute sécurité. Cordialement, ALEK.";
 if(channel==="whatsapp")return NextResponse.json({url:"https://wa.me/?text="+encodeURIComponent(message),notice:"WhatsApp s'ouvre pour confirmation. Aucun document privé n'est publié."});
 if(channel==="sms"){const phone=String(doc.client_phone||"").replace(/[^+0-9]/g,"");if(!/^\+?[0-9]{8,15}$/.test(phone))return NextResponse.json({error:"Numéro de téléphone du client manquant ou invalide"},{status:400});return NextResponse.json({url:"sms:"+phone+"?body="+encodeURIComponent(message),notice:"L'application SMS s'ouvre. Aucun SMS n'est envoyé automatiquement."});}
 const email=String(doc.client_email||"").trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Adresse e-mail du client manquante ou invalide"},{status:400});
 return NextResponse.json({url:"mailto:"+encodeURIComponent(email)+"?subject="+encodeURIComponent("Document ALEK "+number)+"&body="+encodeURIComponent(message),notice:"Votre messagerie s'ouvre. Aucun e-mail n'est envoyé automatiquement."});
 }catch{return NextResponse.json({error:"Requête invalide"},{status:400});}
}