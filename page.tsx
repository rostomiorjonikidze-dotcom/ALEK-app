"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./lib/supabase";

type Lang = "ka" | "ru" | "fr" | "de" | "ar";
type Plan = "free" | "pro" | "business";
type DocumentType = "devis" | "facture";
type HistoryFilter = "all" | DocumentType;
type ServiceType = "labor" | "material";
type PriceType = "total" | "unit" | "hourly";

type ServiceItem = {
  description: string;
  quantity: number;
  price: number;
  type: ServiceType;
  priceType: PriceType;
  hours: number;
};

type SavedDocument = {
  id: string;
  created_at?: string;
  user_id?: string;
  document_type: DocumentType;
  document_number: string;
  document_date: string;
  due_date: string | null;
  client_name: string | null;
  client_address: string | null;
  client_phone: string | null;
  client_email: string | null;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  business_siret: string | null;
  description: string | null;
  services: ServiceItem[] | null;
  vat_rate: number | string | null;
  total_ht: number | string | null;
  total_vat: number | string | null;
  total_ttc: number | string | null;
  payment_terms: string | null;
  payment_method: string | null;
  invoice_status: string | null;
  devis_reference: string | null;
};

const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 10,
  business: Infinity,
};

const translations = {
  ka: {
    appName: "ALEK 🇫🇷",
    subtitle: "აღწერე სამუშაო შენს ენაზე და მიიღე პროფესიონალური ფრანგული Devis ან Facture.",
    siteLanguage: "საიტის ენა",
    inputLanguage: "სამუშაოს აღწერის ენა",
    workDescription: "აღწერე შესრულებული სამუშაო",
    placeholder: "მაგ: 10 საათი შეღებვა 35€/საათი, საღებავი სულ 120€...",
    prepareFrench: "ფრანგულად მომზადება",
    frenchText: "ტექსტი ფრანგულად",
    frenchPlaceholder: "აქ გამოჩნდება პროფესიონალური ფრანგული ტექსტი...",
    currentPlan: "მიმდინარე პაკეტი",
    used: "გამოყენებული",
    remaining: "დარჩენილი",
    unlimited: "ულიმიტო",
    clientInfo: "კლიენტის ინფორმაცია",
    clientName: "კლიენტის სახელი",
    clientAddress: "კლიენტის მისამართი",
    clientPhone: "კლიენტის ტელეფონი",
    clientEmail: "კლიენტის ელფოსტა",
    businessInfo: "კომპანიის ინფორმაცია",
    businessName: "სახელი / კომპანია",
    businessAddress: "კომპანიის მისამართი",
    businessPhone: "ტელეფონი",
    businessEmail: "ელ-ფოსტა",
    businessSiret: "SIRET ან SIREN",
    lookupCompany: "კომპანიის მოძებნა",
    companyFound: "კომპანია მოიძებნა",
    companyNotFound: "კომპანია ვერ მოიძებნა",
    servicePositions: "სამუშაო პოზიციები",
    addService: "ახალი პოზიცია",
    totalPrice: "სულ",
    unitPrice: "ერთეული",
    hourlyPrice: "საათობრივი",
    labor: "სამუშაო",
    material: "მასალა",
    hours: "საათები",
    quantity: "რაოდენობა",
    price: "ფასი",
    devis: "Devis",
    facture: "Facture",
    newDevis: "ახალი Devis",
    newInvoice: "ახალი Facture",
    transform: "Facture-ად გადაყვანა",
    devisNumber: "Devis ნომერი",
    devisDate: "Devis თარიღი",
    validUntil: "მოქმედების ვადა",
    invoiceNumber: "Facture ნომერი",
    devisReference: "Devis-ის référence",
    invoiceDate: "Facture თარიღი",
    dueDate: "გადახდის ვადა",
    paymentTerms: "გადახდის პირობები",
    paymentMethod: "გადახდის მეთოდი",
    invoiceStatus: "Facture-ის სტატუსი",
    unpaid: "გადაუხდელი",
    pending: "მოლოდინში",
    paid: "გადახდილი",
    pricing: "ფასები",
    materials: "მასალები",
    laborTotal: "სამუშაო",
    saveDocument: "დოკუმენტის შენახვა",
    updateDocument: "ცვლილებების შენახვა",
    createPdf: "PDF-ის შექმნა",
    history: "ისტორია",
    documents: "დოკუმენტები",
    close: "დახურვა",
    refresh: "განახლება",
    open: "გახსნა",
    delete: "წაშლა",
    all: "ყველა",
    noDocuments: "შენახული დოკუმენტები ჯერ არ არის.",
    unknownClient: "კლიენტი მითითებული არაა",
    search: "ნომრით ან კლიენტით ძებნა...",
    navHome: "მთავარი",
    navClients: "კლიენტები",
    navDevis: "Devis",
    navFactures: "Factures",
    navHistory: "ისტორია",
    navServices: "სერვისები",
    navSettings: "პარამეტრები",
    logout: "გასვლა",
    saveSuccess: "დოკუმენტი შენახულია.",
    saveError: "დოკუმენტის შენახვა ვერ მოხერხდა.",
    loginRequired: "გთხოვ, ჯერ შეხვიდე ანგარიშში.",
    limitReached: "პაკეტის ლიმიტი ამოიწურა.",
    plans: "პაკეტები",
    free: "Free",
    pro: "Pro",
    business: "Business",
    paymentSoon: "ონლაინ გადახდა მალე დაემატება",
  },
  ru: {
    appName: "ALEK 🇫🇷",
    subtitle: "Опишите работу на своём языке и получите профессиональный французский Devis или Facture.",
    siteLanguage: "Язык сайта",
    inputLanguage: "Язык описания",
    workDescription: "Опишите выполненную работу",
    placeholder: "Например: 10 часов покраски по 35€/час, краска всего 120€...",
    prepareFrench: "Подготовить на французском",
    frenchText: "Текст на французском",
    frenchPlaceholder: "Здесь появится профессиональный французский текст...",
    currentPlan: "Текущий тариф",
    used: "Использовано",
    remaining: "Осталось",
    unlimited: "Безлимит",
    clientInfo: "Информация о клиенте",
    clientName: "Имя клиента",
    clientAddress: "Адрес клиента",
    clientPhone: "Телефон клиента",
    clientEmail: "E-mail клиента",
    businessInfo: "Информация о компании",
    businessName: "Название / Компания",
    businessAddress: "Адрес компании",
    businessPhone: "Телефон",
    businessEmail: "E-mail",
    businessSiret: "SIRET или SIREN",
    lookupCompany: "Найти компанию",
    companyFound: "Компания найдена",
    companyNotFound: "Компания не найдена",
    servicePositions: "Позиции",
    addService: "Добавить позицию",
    totalPrice: "Итого",
    unitPrice: "За единицу",
    hourlyPrice: "Почасовая",
    labor: "Работа",
    material: "Материал",
    hours: "Часы",
    quantity: "Количество",
    price: "Цена",
    devis: "Devis",
    facture: "Facture",
    newDevis: "Новый Devis",
    newInvoice: "Новая Facture",
    transform: "Преобразовать в Facture",
    devisNumber: "Номер Devis",
    devisDate: "Дата Devis",
    validUntil: "Действителен до",
    invoiceNumber: "Номер Facture",
    devisReference: "Référence Devis",
    invoiceDate: "Дата Facture",
    dueDate: "Срок оплаты",
    paymentTerms: "Условия оплаты",
    paymentMethod: "Способ оплаты",
    invoiceStatus: "Статус Facture",
    unpaid: "Не оплачена",
    pending: "Ожидает",
    paid: "Оплачена",
    pricing: "Цены",
    materials: "Материалы",
    laborTotal: "Работа",
    saveDocument: "Сохранить документ",
    updateDocument: "Сохранить изменения",
    createPdf: "Создать PDF",
    history: "История",
    documents: "Документы",
    close: "Закрыть",
    refresh: "Обновить",
    open: "Открыть",
    delete: "Удалить",
    all: "Все",
    noDocuments: "Сохранённых документов пока нет.",
    unknownClient: "Клиент не указан",
    search: "Поиск по номеру или клиенту...",
    navHome: "Главная",
    navClients: "Клиенты",
    navDevis: "Devis",
    navFactures: "Factures",
    navHistory: "История",
    navServices: "Услуги",
    navSettings: "Настройки",
    logout: "Выйти",
    saveSuccess: "Документ сохранён.",
    saveError: "Не удалось сохранить документ.",
    loginRequired: "Сначала войдите в аккаунт.",
    limitReached: "Лимит тарифа исчерпан.",
    plans: "Тарифы",
    free: "Free",
    pro: "Pro",
    business: "Business",
    paymentSoon: "Онлайн-оплата скоро будет добавлена",
  },
  fr: {
    appName: "ALEK 🇫🇷",
    subtitle: "Décrivez les travaux dans votre langue et créez un Devis ou une Facture professionnelle en français.",
    siteLanguage: "Langue du site",
    inputLanguage: "Langue de description",
    workDescription: "Décrivez les travaux effectués",
    placeholder: "Ex. : 10 heures de peinture à 35€/h, peinture 120€ au total...",
    prepareFrench: "Préparer en français",
    frenchText: "Texte en français",
    frenchPlaceholder: "Le texte professionnel apparaîtra ici...",
    currentPlan: "Abonnement actuel",
    used: "Utilisé",
    remaining: "Restant",
    unlimited: "Illimité",
    clientInfo: "Informations client",
    clientName: "Nom du client",
    clientAddress: "Adresse du client",
    clientPhone: "Téléphone du client",
    clientEmail: "E-mail du client",
    businessInfo: "Informations de l’entreprise",
    businessName: "Nom / Entreprise",
    businessAddress: "Adresse de l’entreprise",
    businessPhone: "Téléphone",
    businessEmail: "E-mail",
    businessSiret: "SIRET ou SIREN",
    lookupCompany: "Rechercher l’entreprise",
    companyFound: "Entreprise trouvée",
    companyNotFound: "Entreprise introuvable",
    servicePositions: "Prestations",
    addService: "Ajouter une ligne",
    totalPrice: "Prix total",
    unitPrice: "Prix unitaire",
    hourlyPrice: "Tarif horaire",
    labor: "Main-d’œuvre",
    material: "Fourniture",
    hours: "Heures",
    quantity: "Quantité",
    price: "Prix",
    devis: "Devis",
    facture: "Facture",
    newDevis: "Nouveau devis",
    newInvoice: "Nouvelle facture",
    transform: "Transformer en facture",
    devisNumber: "Numéro du devis",
    devisDate: "Date du devis",
    validUntil: "Valable jusqu’au",
    invoiceNumber: "N° de facture",
    devisReference: "Référence devis",
    invoiceDate: "Date de facture",
    dueDate: "Date d’échéance",
    paymentTerms: "Conditions de paiement",
    paymentMethod: "Mode de paiement",
    invoiceStatus: "Statut de la facture",
    unpaid: "Non payée",
    pending: "En attente",
    paid: "Payée",
    pricing: "Tarification",
    materials: "Fournitures",
    laborTotal: "Main-d’œuvre",
    saveDocument: "Enregistrer le document",
    updateDocument: "Enregistrer les modifications",
    createPdf: "Créer le PDF",
    history: "Historique",
    documents: "Documents",
    close: "Fermer",
    refresh: "Actualiser",
    open: "Ouvrir",
    delete: "Supprimer",
    all: "Tous",
    noDocuments: "Aucun document enregistré.",
    unknownClient: "Client non renseigné",
    search: "Rechercher par numéro ou client...",
    navHome: "Accueil",
    navClients: "Clients",
    navDevis: "Devis",
    navFactures: "Factures",
    navHistory: "Historique",
    navServices: "Prestations",
    navSettings: "Paramètres",
    logout: "Déconnexion",
    saveSuccess: "Document enregistré.",
    saveError: "Impossible d’enregistrer le document.",
    loginRequired: "Veuillez vous connecter.",
    limitReached: "La limite de votre abonnement est atteinte.",
    plans: "Abonnements",
    free: "Gratuit",
    pro: "Pro",
    business: "Business",
    paymentSoon: "Paiement en ligne bientôt disponible",
  },
  ar: {
    appName: "ALEK 🇫🇷",
    subtitle: "صِف العمل بلغتك وأنشئ عرض سعر أو فاتورة احترافية باللغة الفرنسية.",
    siteLanguage: "لغة الموقع", inputLanguage: "لغة وصف العمل", workDescription: "صِف العمل المنجز",
    placeholder: "مثال: 10 ساعات دهان بسعر 35€ للساعة، والطلاء 120€ إجمالاً...", prepareFrench: "إعداد بالفرنسية",
    frenchText: "النص بالفرنسية", frenchPlaceholder: "سيظهر النص الفرنسي الاحترافي هنا...", currentPlan: "الباقة الحالية", used: "المستخدم", remaining: "المتبقي", unlimited: "غير محدود",
    clientInfo: "معلومات العميل", clientName: "اسم العميل", clientAddress: "عنوان العميل", clientPhone: "هاتف العميل", clientEmail: "البريد الإلكتروني للعميل",
    businessInfo: "معلومات الشركة", businessName: "الاسم / الشركة", businessAddress: "عنوان الشركة", businessPhone: "الهاتف", businessEmail: "البريد الإلكتروني", businessSiret: "SIRET أو SIREN",
    lookupCompany: "البحث عن الشركة", companyFound: "تم العثور على الشركة", companyNotFound: "لم يتم العثور على الشركة", servicePositions: "الخدمات", addService: "إضافة بند",
    totalPrice: "السعر الإجمالي", unitPrice: "سعر الوحدة", hourlyPrice: "سعر الساعة", labor: "العمل", material: "المواد", hours: "الساعات", quantity: "الكمية", price: "السعر",
    devis: "عرض سعر", facture: "فاتورة", newDevis: "عرض سعر جديد", newInvoice: "فاتورة جديدة", transform: "تحويل إلى فاتورة", devisNumber: "رقم عرض السعر", devisDate: "تاريخ عرض السعر", validUntil: "صالح حتى",
    invoiceNumber: "رقم الفاتورة", devisReference: "مرجع عرض السعر", invoiceDate: "تاريخ الفاتورة", dueDate: "تاريخ الاستحقاق", paymentTerms: "شروط الدفع", paymentMethod: "طريقة الدفع", invoiceStatus: "حالة الفاتورة",
    unpaid: "غير مدفوعة", pending: "قيد الانتظار", paid: "مدفوعة", pricing: "التسعير", materials: "المواد", laborTotal: "العمل", saveDocument: "حفظ المستند", updateDocument: "حفظ التغييرات", createPdf: "إنشاء PDF",
    history: "السجل", documents: "المستندات", close: "إغلاق", refresh: "تحديث", open: "فتح", delete: "حذف", all: "الكل", noDocuments: "لا توجد مستندات محفوظة بعد.", unknownClient: "العميل غير محدد", search: "البحث بالرقم أو العميل...",
    navHome: "الرئيسية", navClients: "العملاء", navDevis: "عروض الأسعار", navFactures: "الفواتير", navHistory: "السجل", navServices: "الخدمات", navSettings: "الإعدادات", logout: "تسجيل الخروج",
    saveSuccess: "تم حفظ المستند.", saveError: "تعذر حفظ المستند.", loginRequired: "يرجى تسجيل الدخول أولاً.", limitReached: "تم الوصول إلى حد الباقة.", plans: "الباقات", free: "مجاني", pro: "Pro", business: "Business", paymentSoon: "الدفع عبر الإنترنت سيتوفر قريباً",
  },
  de: {
    appName: "ALEK 🇫🇷",
    subtitle: "Beschreiben Sie die Arbeit in Ihrer Sprache und erstellen Sie ein professionelles französisches Devis oder eine Facture.",
    siteLanguage: "Sprache der Website",
    inputLanguage: "Sprache der Beschreibung",
    workDescription: "Beschreiben Sie die ausgeführten Arbeiten",
    placeholder: "Beispiel: 10 Stunden Malerarbeit à 35€/Stunde, Farbe insgesamt 120€...",
    prepareFrench: "Auf Französisch vorbereiten",
    frenchText: "Text auf Französisch",
    frenchPlaceholder: "Hier erscheint der professionelle französische Text...",
    currentPlan: "Aktueller Tarif",
    used: "Verwendet",
    remaining: "Verbleibend",
    unlimited: "Unbegrenzt",
    clientInfo: "Kundeninformationen",
    clientName: "Name des Kunden",
    clientAddress: "Adresse des Kunden",
    clientPhone: "Telefon des Kunden",
    clientEmail: "E-Mail des Kunden",
    businessInfo: "Unternehmensinformationen",
    businessName: "Name / Unternehmen",
    businessAddress: "Firmenadresse",
    businessPhone: "Telefon",
    businessEmail: "E-Mail",
    businessSiret: "SIRET oder SIREN",
    lookupCompany: "Unternehmen suchen",
    companyFound: "Unternehmen gefunden",
    companyNotFound: "Unternehmen nicht gefunden",
    servicePositions: "Leistungspositionen",
    addService: "Position hinzufügen",
    totalPrice: "Gesamtpreis",
    unitPrice: "Stückpreis",
    hourlyPrice: "Stundensatz",
    labor: "Arbeit",
    material: "Material",
    hours: "Stunden",
    quantity: "Menge",
    price: "Preis",
    devis: "Devis",
    facture: "Facture",
    newDevis: "Neues Devis",
    newInvoice: "Neue Facture",
    transform: "In Facture umwandeln",
    devisNumber: "Devis-Nummer",
    devisDate: "Devis-Datum",
    validUntil: "Gültig bis",
    invoiceNumber: "Facture-Nummer",
    devisReference: "Devis-Referenz",
    invoiceDate: "Facture-Datum",
    dueDate: "Fälligkeitsdatum",
    paymentTerms: "Zahlungsbedingungen",
    paymentMethod: "Zahlungsart",
    invoiceStatus: "Facture-Status",
    unpaid: "Unbezahlt",
    pending: "Ausstehend",
    paid: "Bezahlt",
    pricing: "Preise",
    materials: "Material",
    laborTotal: "Arbeit",
    saveDocument: "Dokument speichern",
    updateDocument: "Änderungen speichern",
    createPdf: "PDF erstellen",
    history: "Verlauf",
    documents: "Dokumente",
    close: "Schließen",
    refresh: "Aktualisieren",
    open: "Öffnen",
    delete: "Löschen",
    all: "Alle",
    noDocuments: "Noch keine gespeicherten Dokumente.",
    unknownClient: "Kein Kunde angegeben",
    search: "Nach Nummer oder Kunde suchen...",
    navHome: "Start",
    navClients: "Kunden",
    navDevis: "Devis",
    navFactures: "Factures",
    navHistory: "Verlauf",
    navServices: "Leistungen",
    navSettings: "Einstellungen",
    logout: "Abmelden",
    saveSuccess: "Dokument gespeichert.",
    saveError: "Dokument konnte nicht gespeichert werden.",
    loginRequired: "Bitte zuerst anmelden.",
    limitReached: "Das Tariflimit ist erreicht.",
    plans: "Tarife",
    free: "Free",
    pro: "Pro",
    business: "Business",
    paymentSoon: "Online-Zahlung folgt in Kürze",
  },
} as const;

const languageNames: Record<Lang, string> = {
  ka: "🇬🇪 ქართული",
  ru: "🇷🇺 Русский",
  fr: "🇫🇷 Français",
  de: "🇩🇪 Deutsch",
  ar: "🇸🇦 العربية",
};

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function datePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function normalizeService(raw: any): ServiceItem {
  const description = String(raw?.description || "");
  const rawType = String(raw?.type || "labor").toLowerCase();
  const rawPriceType = String(raw?.priceType || "total").toLowerCase();
  const hourlyText = /\b(heure|heures|horaire|hour|hours|stunde|stunden|час|часа|часов)\b|\/h\b/i.test(description);
  const priceType: PriceType =
    rawPriceType === "hourly" || hourlyText
      ? "hourly"
      : rawPriceType === "unit"
        ? "unit"
        : "total";

  return {
    description,
    quantity: Number(raw?.quantity) || 1,
    price: Number(raw?.price) || 0,
    type: rawType === "material" ? "material" : "labor",
    priceType,
    hours: Number(raw?.hours) || (priceType === "hourly" ? Number(raw?.quantity) || 1 : 1),
  };
}

function serviceTotal(item: ServiceItem) {
  if (item.priceType === "hourly") return Number(item.hours || 0) * Number(item.price || 0);
  if (item.priceType === "unit") return Number(item.quantity || 0) * Number(item.price || 0);
  return Number(item.price || 0);
}

export default function Home() {
  const [siteLang, setSiteLang] = useState<Lang>("ka");
  const [inputLang, setInputLang] = useState<Lang>("ka");
  const t = translations[siteLang];

  const [description, setDescription] = useState("");
  const [frenchText, setFrenchText] = useState("");
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessSiret, setBusinessSiret] = useState("");
  const [companyLookupStatus, setCompanyLookupStatus] = useState<"" | "loading" | "found" | "notfound">("");

  const [documentType, setDocumentType] = useState<DocumentType>("devis");
  const [devisNumber, setDevisNumber] = useState("");
  const [devisDate, setDevisDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [devisReference, setDevisReference] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("unpaid");
  const [vatRate, setVatRate] = useState(0);

  const [plan, setPlan] = useState<Plan>("free");
  const [usageCount, setUsageCount] = useState(0);
  const [userRole, setUserRole] = useState("user");
  const [userEmail, setUserEmail] = useState("");

  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  const [hydrated, setHydrated] = useState(false);

  const materialFromServices = useMemo(
    () => services.filter((item) => item.type === "material").reduce((sum, item) => sum + serviceTotal(item), 0),
    [services],
  );

  const laborFromServices = useMemo(
    () => services.filter((item) => item.type === "labor").reduce((sum, item) => sum + serviceTotal(item), 0),
    [services],
  );

  const totalHT = materialFromServices + laborFromServices;
  const vatAmount = totalHT * (vatRate / 100);
  const totalTTC = totalHT + vatAmount;
  const hasUnlimitedAi = userRole === "owner" || plan === "business";
  const limit = hasUnlimitedAi ? Infinity : PLAN_LIMITS[plan];
  const remaining = hasUnlimitedAi ? Infinity : Math.max(limit - usageCount, 0);

  const filteredDocuments = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return savedDocuments.filter((doc) => {
      if (historyFilter !== "all" && doc.document_type !== historyFilter) return false;
      if (!q) return true;
      return `${doc.document_number} ${doc.client_name || ""}`.toLowerCase().includes(q);
    });
  }, [savedDocuments, historyFilter, historySearch]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("alek-draft-v2");
      if (raw) {
        const draft = JSON.parse(raw);
        setSiteLang((draft.siteLang || "ka") as Lang);
        setInputLang((draft.inputLang || "ka") as Lang);
        setDescription(draft.description || "");
        setFrenchText(draft.frenchText || "");
        setServices(Array.isArray(draft.services) ? draft.services.map(normalizeService) : []);
        setClientName(draft.clientName || "");
        setClientAddress(draft.clientAddress || "");
        setClientPhone(draft.clientPhone || "");
        setClientEmail(draft.clientEmail || "");
        setBusinessName(draft.businessName || "");
        setBusinessAddress(draft.businessAddress || "");
        setBusinessPhone(draft.businessPhone || "");
        setBusinessEmail(draft.businessEmail || "");
        setBusinessSiret(draft.businessSiret || "");
        setDocumentType(draft.documentType === "facture" ? "facture" : "devis");
        setDevisNumber(draft.devisNumber || "");
        setDevisDate(draft.devisDate || "");
        setValidUntil(draft.validUntil || "");
        setInvoiceNumber(draft.invoiceNumber || "");
        setDevisReference(draft.devisReference || "");
        setInvoiceDate(draft.invoiceDate || "");
        setInvoiceDueDate(draft.invoiceDueDate || "");
        setPaymentTerms(draft.paymentTerms || "");
        setPaymentMethod(draft.paymentMethod || "");
        setInvoiceStatus(draft.invoiceStatus || "unpaid");
        setVatRate(Number(draft.vatRate) || 0);
      } else {
        const number = nextDocumentNumber("devis");
        setDevisNumber(number);
        setDevisDate(todayInput());
        setValidUntil(datePlusDays(30));
      }
    } catch (error) {
      console.error("Draft load error", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      "alek-draft-v2",
      JSON.stringify({
        siteLang,
        inputLang,
        description,
        frenchText,
        services,
        clientName,
        clientAddress,
        clientPhone,
        clientEmail,
        businessName,
        businessAddress,
        businessPhone,
        businessEmail,
        businessSiret,
        documentType,
        devisNumber,
        devisDate,
        validUntil,
        invoiceNumber,
        devisReference,
        invoiceDate,
        invoiceDueDate,
        paymentTerms,
        paymentMethod,
        invoiceStatus,
        vatRate,
      }),
    );
  }, [
    hydrated,
    siteLang,
    inputLang,
    description,
    frenchText,
    services,
    clientName,
    clientAddress,
    clientPhone,
    clientEmail,
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    businessSiret,
    documentType,
    devisNumber,
    devisDate,
    validUntil,
    invoiceNumber,
    devisReference,
    invoiceDate,
    invoiceDueDate,
    paymentTerms,
    paymentMethod,
    invoiceStatus,
    vatRate,
  ]);

  useEffect(() => {
    void loadProfile();
    void loadDocuments();
  }, []);

  function nextDocumentNumber(type: DocumentType) {
    const key = type === "devis" ? "alek-devis-counter" : "alek-invoice-counter";
    const prefix = type === "devis" ? "DEV" : "FAC";
    const next = (Number(localStorage.getItem(key)) || 0) + 1;
    localStorage.setItem(key, String(next));
    return `${prefix}-${new Date().getFullYear()}-${String(next).padStart(3, "0")}`;
  }

  async function loadProfile() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserEmail(user.email || "");

    const { data, error } = await supabase
      .from("profiles")
      .select("role, plan, usage_count")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error.message);
      return;
    }
    if (!data) return;
    setUserRole(data.role || "user");
    setPlan((data.plan || "free") as Plan);
    setUsageCount(Number(data.usage_count) || 0);
  }

  async function loadDocuments() {
    setHistoryLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Documents load error:", error.message);
        return;
      }

      setSavedDocuments((data || []) as SavedDocument[]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function scrollToSection(id: string) {
    setShowHistory(false);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  }

  function openHistory() {
    setShowHistory(true);
    void loadDocuments();
    window.setTimeout(() => document.getElementById("history-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function createNewDevis() {
    setSelectedDocumentId(null);
    setShowHistory(false);
    setDocumentType("devis");
    setDevisNumber(nextDocumentNumber("devis"));
    setDevisDate(todayInput());
    setValidUntil(datePlusDays(30));
    setDescription("");
    setFrenchText("");
    setServices([]);
    setClientName("");
    setClientAddress("");
    setClientPhone("");
    setClientEmail("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createNewInvoice() {
    setSelectedDocumentId(null);
    setShowHistory(false);
    setDocumentType("facture");
    setInvoiceNumber(nextDocumentNumber("facture"));
    setInvoiceDate(todayInput());
    setInvoiceDueDate(datePlusDays(30));
    setDevisReference("");
    setPaymentTerms("");
    setPaymentMethod("");
    setInvoiceStatus("unpaid");
    setDescription("");
    setFrenchText("");
    setServices([]);
    setClientName("");
    setClientAddress("");
    setClientPhone("");
    setClientEmail("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function transformToInvoice() {
    const sourceDevis = devisNumber;
    setSelectedDocumentId(null);
    setDocumentType("facture");
    setInvoiceNumber(nextDocumentNumber("facture"));
    setDevisReference(sourceDevis);
    setInvoiceDate(todayInput());
    setInvoiceDueDate(datePlusDays(30));
    setPaymentTerms("");
    setPaymentMethod("");
    setInvoiceStatus("unpaid");
  }

  async function prepareFrenchText() {
    if (!description.trim()) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ description, inputLanguage: inputLang }),
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("Invalid AI response");
      }

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (response.status === 429) {
        if (typeof data.usageCount === "number") setUsageCount(data.usageCount);
        alert(t.limitReached);
        return;
      }

      if (!response.ok) throw new Error(data.error || "AI request failed");

      setFrenchText(data.frenchText || "");
      setServices(Array.isArray(data.services) ? data.services.map(normalizeService) : []);

      if (typeof data.usageCount === "number") {
        setUsageCount(data.usageCount);
      }

      if (data.plan === "free" || data.plan === "pro" || data.plan === "business") {
        setPlan(data.plan as Plan);
      }

      if (data.role) {
        setUserRole(String(data.role));
      }
    } catch (error) {
      console.error(error);
      alert("AI connection error");
    }
  }

  async function lookupCompany() {
    const identifier = businessSiret.replace(/\D/g, "");
    if (![9, 14].includes(identifier.length)) {
      setCompanyLookupStatus("notfound");
      return;
    }

    setCompanyLookupStatus("loading");
    try {
      const response = await fetch(`/api/company?identifier=${encodeURIComponent(identifier)}`);
      const data = await response.json();
      if (!response.ok || !data?.name) throw new Error(data?.error || "Company not found");

      setBusinessName(data.name || businessName);
      setBusinessAddress(data.address || businessAddress);
      setBusinessSiret(data.siret || data.siren || identifier);
      setCompanyLookupStatus("found");
    } catch (error) {
      console.error(error);
      setCompanyLookupStatus("notfound");
    }
  }

  function buildPayload(userId: string) {
    return {
      user_id: userId,
      document_type: documentType,
      document_number: documentType === "facture" ? invoiceNumber : devisNumber,
      document_date: documentType === "facture" ? invoiceDate : devisDate,
      due_date: documentType === "facture" ? invoiceDueDate || null : validUntil || null,
      client_name: clientName || null,
      client_address: clientAddress || null,
      client_phone: clientPhone || null,
      client_email: clientEmail || null,
      business_name: businessName || null,
      business_address: businessAddress || null,
      business_phone: businessPhone || null,
      business_email: businessEmail || null,
      business_siret: businessSiret || null,
      description: frenchText || null,
      services,
      vat_rate: vatRate,
      total_ht: totalHT,
      total_vat: vatAmount,
      total_ttc: totalTTC,
      payment_terms: documentType === "facture" ? paymentTerms || null : null,
      payment_method: documentType === "facture" ? paymentMethod || null : null,
      invoice_status: documentType === "facture" ? invoiceStatus : null,
      devis_reference: documentType === "facture" ? devisReference || null : null,
    };
  }

  async function saveDocumentToDatabase() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      alert(t.loginRequired);
      return;
    }

    const payload = buildPayload(user.id);
    const query = selectedDocumentId
      ? supabase.from("documents").update(payload).eq("id", selectedDocumentId).select("*").single()
      : supabase.from("documents").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error) {
      console.error(`Save document error: ${error.message} | ${error.code || ""}`);
      alert(t.saveError);
      return;
    }

    if (data?.id) setSelectedDocumentId(data.id);
    await loadDocuments();
    alert(t.saveSuccess);
  }

  function openSavedDocument(doc: SavedDocument) {
    setSelectedDocumentId(doc.id);
    setShowHistory(false);
    setDocumentType(doc.document_type);
    setClientName(doc.client_name || "");
    setClientAddress(doc.client_address || "");
    setClientPhone(doc.client_phone || "");
    setClientEmail(doc.client_email || "");
    setBusinessName(doc.business_name || "");
    setBusinessAddress(doc.business_address || "");
    setBusinessPhone(doc.business_phone || "");
    setBusinessEmail(doc.business_email || "");
    setBusinessSiret(doc.business_siret || "");
    setFrenchText(doc.description || "");
    setDescription(doc.description || "");
    setServices(Array.isArray(doc.services) ? doc.services.map(normalizeService) : []);
    setVatRate(Number(doc.vat_rate) || 0);

    if (doc.document_type === "facture") {
      setInvoiceNumber(doc.document_number || "");
      setInvoiceDate(doc.document_date || "");
      setInvoiceDueDate(doc.due_date || "");
      setPaymentTerms(doc.payment_terms || "");
      setPaymentMethod(doc.payment_method || "");
      setInvoiceStatus(doc.invoice_status || "unpaid");
      setDevisReference(doc.devis_reference || "");
    } else {
      setDevisNumber(doc.document_number || "");
      setDevisDate(doc.document_date || "");
      setValidUntil(doc.due_date || "");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteSavedDocument(id: string) {
    if (!window.confirm(`${t.delete}?`)) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    if (selectedDocumentId === id) setSelectedDocumentId(null);
    await loadDocuments();
  }

  function createPdf() {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(documentType === "facture" ? "FACTURE" : "DEVIS", 105, 25, { align: "center" });
    doc.setDrawColor(0, 125, 220);
    doc.setLineWidth(0.8);
    doc.line(75, 31, 135, 31);

    doc.setFontSize(10);
    doc.text("N° :", 20, 44);
    doc.text("Date :", 20, 51);
    doc.text(documentType === "devis" ? "Valable jusqu'au :" : "Date d'échéance :", 20, 58);
    doc.setFont("helvetica", "normal");
    doc.text(documentType === "facture" ? invoiceNumber || "-" : devisNumber || "-", 55, 44);
    doc.text(documentType === "facture" ? invoiceDate || "-" : devisDate || "-", 55, 51);
    doc.text(documentType === "facture" ? invoiceDueDate || "-" : validUntil || "-", 55, 58);

    if (documentType === "facture" && devisReference) {
      doc.text(`Référence devis : ${devisReference}`, 20, 65);
    }

   const businessNameLines = doc.splitTextToSize(
  `Entreprise: ${businessName || "-"}`,
  70
);

const businessBoxHeight = 38 + (businessNameLines.length - 1) * 7;

doc.setFillColor(238, 246, 255);
doc.roundedRect(15, 72, 80, businessBoxHeight, 2, 2, "F");
doc.roundedRect(105, 72, 90, 31, 2, 2, "F");

doc.setFont("helvetica", "bold");
doc.text(businessNameLines, 20, 79);

const businessInfoY = 79 + businessNameLines.length * 7;
doc.setFont("helvetica", "normal");
doc.text(`Adresse: ${businessAddress || "-"}`, 20, businessInfoY);
doc.text(`Téléphone: ${businessPhone || "-"}`, 20, businessInfoY + 7);
doc.text(`E-mail: ${businessEmail || "-"}`, 20, businessInfoY + 14);
doc.text(`SIRET: ${businessSiret || "-"}`, 20, businessInfoY + 21);
  

    doc.text(`Client: ${clientName || "-"}`, 110, 79);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Adresse: ${clientAddress || "-"}`, 110, 86);
    doc.text(`Téléphone: ${clientPhone || "-"}`, 110, 93);
    doc.text(`E-mail: ${clientEmail || "-"}`, 110, 100);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Description des travaux", 20, 122);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(frenchText || "-", 170) as string[];
    let y = 130;
    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += 5;
    }

    autoTable(doc, {
      startY: y + 4,
      head: [["Description", "Qté / Heures", "Prix", "Total"]],
      body: services.map((service) => [
        service.description || "-",
        service.priceType === "hourly" ? `${service.hours} h` : String(service.quantity),
        service.priceType === "hourly" ? `${service.price.toFixed(2)} EUR/h` : `${service.price.toFixed(2)} EUR`,
        `${serviceTotal(service).toFixed(2)} EUR`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 125, 220] },
    });

    let finalY = ((doc as any).lastAutoTable?.finalY || y) + 10;
    if (finalY > 240) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(11);
    doc.text(`Total HT: ${totalHT.toFixed(2)} EUR`, 20, finalY);
    doc.text(`TVA (${vatRate}%): ${vatAmount.toFixed(2)} EUR`, 20, finalY + 8);
    doc.setFillColor(230, 242, 255);
    doc.rect(20, finalY + 12, 170, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Total TTC: ${totalTTC.toFixed(2)} EUR`, 25, finalY + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    if (documentType === "facture") {
      let infoY = finalY + 38;
      if (paymentTerms) {
        doc.text(`Conditions de paiement : ${paymentTerms}`, 20, infoY);
        infoY += 7;
      }
      if (paymentMethod) {
        doc.text(`Mode de paiement : ${paymentMethod}`, 20, infoY);
        infoY += 7;
      }
      const statusText = invoiceStatus === "paid" ? "Payée" : invoiceStatus === "pending" ? "En attente" : "Non payée";
      doc.text(`Statut : ${statusText}`, 20, infoY);
    }

    doc.save(
      documentType === "facture"
        ? `ALEK-Facture-${invoiceNumber || "nouvelle"}.pdf`
        : `ALEK-Devis-${devisNumber || "nouveau"}.pdf`,
    );
  }

  const navButton = "w-full rounded-xl px-4 py-3 text-left font-medium text-stone-600 transition hover:bg-[#f8efe5]";

  return (
    <main dir={siteLang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-[#fff8f0] via-[#fffdf9] to-[#f8efe5] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:pl-72">
        <aside className="fixed bottom-6 left-6 top-6 hidden w-60 overflow-y-auto rounded-[28px] border border-orange-100/80 bg-[#fffdf9]/95 p-4 shadow-[0_18px_50px_rgba(120,72,24,0.10)] backdrop-blur lg:block">
          <div className="mb-7 flex items-center gap-3 px-2">
            <img src="/alek-logo.png" alt="ALEK" className="h-11 w-11 rounded-xl object-cover" />
            <div>
              <p className="text-xl font-extrabold tracking-wide">ALEK</p>
              {userRole === "owner" && <p className="text-xs font-semibold text-amber-700">OWNER • ∞</p>}
            </div>
          </div>

          <nav className="space-y-1">
            <button type="button" onClick={() => { setShowHistory(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`${navButton} bg-amber-600 text-white hover:bg-amber-700`}>🏠 {t.navHome}</button>
            <button type="button" onClick={() => scrollToSection("client-section")} className={navButton}>👥 {t.navClients}</button>
            <button type="button" onClick={() => { setDocumentType("devis"); scrollToSection("document-section"); }} className={navButton}>📄 {t.navDevis}</button>
            <button type="button" onClick={() => { setDocumentType("facture"); scrollToSection("document-section"); }} className={navButton}>🧾 {t.navFactures}</button>
            <button type="button" onClick={openHistory} className={navButton}>🕘 {t.navHistory}</button>
            <button type="button" onClick={() => scrollToSection("services-section")} className={navButton}>🛠️ {t.navServices}</button>
            <button type="button" onClick={() => scrollToSection("settings-section")} className={navButton}>⚙️ {t.navSettings}</button>
          </nav>

          <div className="mt-8 border-t pt-4">
            {userEmail && <p className="mb-2 truncate px-2 text-xs text-stone-500">{userEmail}</p>}
            <button type="button" onClick={logout} className="w-full rounded-xl px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50">↪ {t.logout}</button>
          </div>
        </aside>

        <div className="mb-5 flex flex-col gap-5 rounded-[28px] border border-orange-100/80 bg-gradient-to-r from-[#fff4e8] via-[#fffdf9] to-[#fff8f0] p-5 shadow-[0_16px_40px_rgba(120,72,24,0.09)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src="/alek-logo.png" alt="ALEK" className="h-12 w-12 rounded-xl object-cover" />
            <div>
              <p className="text-xl font-extrabold tracking-wide">{t.appName}</p>
              <p className="mt-1 max-w-2xl text-sm text-stone-500">{t.subtitle}</p>
            </div>
          </div>
          <div className="min-w-[180px]">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-stone-500">{t.siteLanguage}</label>
            <select value={siteLang} onChange={(e) => setSiteLang(e.target.value as Lang)} className="w-full rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
              {(Object.keys(languageNames) as Lang[]).map((lang) => <option key={lang} value={lang}>{languageNames[lang]}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-orange-100 bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(120,72,24,0.08)]"><p className="text-sm text-stone-500">{t.currentPlan}</p><p className="mt-2 text-2xl font-extrabold">{userRole === "owner" ? "Owner" : plan === "free" ? t.free : plan === "pro" ? t.pro : t.business}</p></div>
          <div className="rounded-2xl border border-orange-100 bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(120,72,24,0.08)]"><p className="text-sm text-stone-500">{t.used}</p><p className="mt-2 text-2xl font-extrabold">{userRole === "owner" ? 0 : usageCount}</p></div>
          <div className="rounded-2xl border border-orange-100 bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(120,72,24,0.08)]"><p className="text-sm text-stone-500">{t.remaining}</p><p className="mt-2 text-2xl font-extrabold">{hasUnlimitedAi ? t.unlimited : remaining}</p></div>
        </div>

        {showHistory && (
          <section id="history-section" className="mb-7 scroll-mt-6 rounded-3xl border border-orange-100 bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(120,72,24,0.08)] sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold text-amber-700">{t.documents}</p><h2 className="text-2xl font-bold">{t.history}</h2></div>
              <div className="flex gap-2"><button type="button" onClick={() => void loadDocuments()} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold">↻ {t.refresh}</button><button type="button" onClick={() => setShowHistory(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold">{t.close}</button></div>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder={t.search} className="rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3 outline-none focus:border-amber-500" />
              <div className="flex gap-2">
                {(["all", "devis", "facture"] as HistoryFilter[]).map((filter) => <button key={filter} type="button" onClick={() => setHistoryFilter(filter)} className={`rounded-xl px-4 py-3 text-sm font-semibold ${historyFilter === filter ? "bg-amber-600 text-white" : "border border-orange-100 bg-[#fffdf9]"}`}>{filter === "all" ? t.all : filter === "devis" ? t.devis : t.facture}</button>)}
              </div>
            </div>

            {historyLoading ? <p className="text-stone-500">Loading...</p> : filteredDocuments.length === 0 ? <p className="text-stone-500">{t.noDocuments}</p> : <div className="space-y-3">{filteredDocuments.map((doc) => <div key={doc.id} className="rounded-2xl border border-orange-100 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${doc.document_type === "facture" ? "bg-purple-50 text-purple-700" : "bg-amber-50 text-amber-800"}`}>{doc.document_type === "facture" ? t.facture : t.devis}</span><p className="font-bold">{doc.document_number}</p></div><p className="mt-2 text-sm text-stone-500">{doc.client_name || t.unknownClient} • {doc.document_date || "-"}</p></div><div className="flex items-center gap-2"><p className="mr-2 font-bold">{Number(doc.total_ttc || 0).toFixed(2)} €</p><button type="button" onClick={() => openSavedDocument(doc)} className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white">{t.open}</button><button type="button" onClick={() => void deleteSavedDocument(doc.id)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">{t.delete}</button></div></div></div>)}</div>}
          </section>
        )}

        <div className="space-y-7">
          <section className="rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <p className="text-sm font-semibold text-amber-700">✨ AI Assistant</p>
            <h2 className="mt-1 text-2xl font-extrabold">{t.workDescription}</h2>
            <label className="mb-2 mt-5 block text-sm font-semibold text-stone-700">{t.inputLanguage}</label>
            <select value={inputLang} onChange={(e) => setInputLang(e.target.value as Lang)} className="w-full rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3 outline-none focus:border-amber-500">
              {(Object.keys(languageNames) as Lang[]).map((lang) => <option key={lang} value={lang}>{languageNames[lang]}</option>)}
            </select>
            <textarea dir={inputLang === "ar" ? "rtl" : "ltr"} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.placeholder} className="mt-4 h-40 w-full resize-none rounded-2xl border border-orange-100 bg-[#fff9f3] p-4 outline-none focus:border-amber-500 focus:bg-[#fffdf9]" />
            <button type="button" onClick={prepareFrenchText} className="mt-4 w-full rounded-2xl bg-amber-600 px-5 py-4 font-bold text-white hover:bg-amber-700">✨ {t.prepareFrench}</button>
          </section>

          <section className="rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <p className="text-sm font-semibold text-green-600">🇫🇷 Texte professionnel</p>
            <h3 className="mt-1 text-xl font-extrabold">{t.frenchText}</h3>
            <textarea value={frenchText} onChange={(e) => setFrenchText(e.target.value)} placeholder={t.frenchPlaceholder} className="mt-4 h-40 w-full resize-none rounded-2xl border border-orange-100 bg-[#fff9f3] p-4 outline-none focus:border-green-500 focus:bg-[#fffdf9]" />
          </section>

          <section id="document-section" className="scroll-mt-6 rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDocumentType("devis")} className={`rounded-xl px-4 py-3 font-bold ${documentType === "devis" ? "bg-amber-600 text-white" : "border border-orange-100 bg-[#fff9f3]"}`}>📄 {t.devis.toUpperCase()}</button>
              <button type="button" onClick={() => setDocumentType("facture")} className={`rounded-xl px-4 py-3 font-bold ${documentType === "facture" ? "bg-amber-600 text-white" : "border border-orange-100 bg-[#fff9f3]"}`}>🧾 {t.facture.toUpperCase()}</button>
            </div>
            {documentType === "devis" && <div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={transformToInvoice} className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white">→ {t.transform}</button><button type="button" onClick={createNewDevis} className="rounded-xl border border-amber-600 px-4 py-3 font-semibold text-amber-700">+ {t.newDevis}</button></div>}
            {documentType === "facture" && <button type="button" onClick={createNewInvoice} className="mt-3 w-full rounded-xl border border-amber-600 px-4 py-3 font-semibold text-amber-700">+ {t.newInvoice}</button>}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {documentType === "devis" ? <><input value={devisNumber} onChange={(e) => setDevisNumber(e.target.value)} placeholder={t.devisNumber} className="rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /><label className="text-sm font-medium">{t.devisDate}<input type="date" value={devisDate} onChange={(e) => setDevisDate(e.target.value)} className="mt-2 w-full rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /></label><label className="text-sm font-medium">{t.validUntil}<input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-2 w-full rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /></label></> : <><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder={t.invoiceNumber} className="rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /><input value={devisReference} onChange={(e) => setDevisReference(e.target.value)} placeholder={t.devisReference} className="rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /><label className="text-sm font-medium">{t.invoiceDate}<input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-2 w-full rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /></label><label className="text-sm font-medium">{t.dueDate}<input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} className="mt-2 w-full rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /></label><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder={t.paymentTerms} className="rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3" /><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3"><option value="">{t.paymentMethod}</option><option value="Virement bancaire">Virement bancaire</option><option value="Carte bancaire">Carte bancaire</option><option value="Espèces">Espèces</option><option value="Chèque">Chèque</option></select><select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className="rounded-xl border border-orange-100 bg-[#fff9f3] px-4 py-3"><option value="unpaid">{t.unpaid}</option><option value="pending">{t.pending}</option><option value="paid">{t.paid}</option></select></>}
            </div>
          </section>

          <section id="services-section" className="scroll-mt-6 rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-amber-700">Prestations</p><h2 className="text-2xl font-bold">{t.servicePositions}</h2></div><button type="button" onClick={() => setServices((current) => [...current, normalizeService({})])} className="rounded-xl border border-amber-600 px-4 py-2 font-semibold text-amber-700">+ {t.addService}</button></div>
            <div className="space-y-4">
              {services.map((service, index) => <div key={index} className="rounded-2xl border border-orange-100 bg-[#fff9f3] p-4"><div className="grid gap-3 lg:grid-cols-12"><input value={service.description} onChange={(e) => setServices((items) => items.map((x, i) => i === index ? { ...x, description: e.target.value } : x))} placeholder="Description" className="rounded-xl border border-orange-100 bg-[#fffdf9] px-3 py-3 lg:col-span-4" />{service.priceType === "hourly" ? <label className="text-xs font-semibold text-stone-500 lg:col-span-2">{t.hours}<input type="number" min="0" step="0.25" value={service.hours} onChange={(e) => setServices((items) => items.map((x, i) => i === index ? { ...x, hours: Number(e.target.value) } : x))} className="mt-1 w-full rounded-xl border border-orange-100 bg-[#fffdf9] px-3 py-3 text-base font-normal text-stone-900" /></label> : <label className="text-xs font-semibold text-stone-500 lg:col-span-2">{t.quantity}<input type="number" min="0" step="0.01" value={service.quantity} onChange={(e) => setServices((items) => items.map((x, i) => i === index ? { ...x, quantity: Number(e.target.value) } : x))} className="mt-1 w-full rounded-xl border border-orange-100 bg-[#fffdf9] px-3 py-3 text-base font-normal text-stone-900" /></label>}<label className="text-xs font-semibold text-stone-500 lg:col-span-2">{service.priceType === "hourly" ? `${t.price} / h` : t.price}<input type="number" min="0" step="0.01" value={service.price} onChange={(e) => setServices((items) => items.map((x, i) => i === index ? { ...x, price: Number(e.target.value) } : x))} className="mt-1 w-full rounded-xl border border-orange-100 bg-[#fffdf9] px-3 py-3 text-base font-normal text-stone-900" /></label><select value={service.priceType} onChange={(e) => setServices((items) => items.map((x, i) => i === index ? { ...x, priceType: e.target.value as PriceType } : x))} className="rounded-xl border border-orange-100 bg-[#fffdf9] px-3 py-3 lg:col-span-2"><option value="total">{t.totalPrice}</option><option value="unit">{t.unitPrice}</option><option value="hourly">{t.hourlyPrice}</option></select><select value={service.type} onChange={(e) => setServices((items) => items.map((x, i) => i === index ? { ...x, type: e.target.value as ServiceType } : x))} className="rounded-xl border border-orange-100 bg-[#fffdf9] px-3 py-3 lg:col-span-1"><option value="labor">{t.labor}</option><option value="material">{t.material}</option></select><button type="button" onClick={() => setServices((items) => items.filter((_, i) => i !== index))} className="rounded-xl border border-red-200 px-3 py-3 text-red-600 lg:col-span-1">🗑️</button></div><div className="mt-3 text-right font-bold">{serviceTotal(service).toFixed(2)} €</div></div>)}
            </div>
          </section>

          <section id="client-section" className="scroll-mt-6 rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-3 text-xl">👤</div><div><p className="text-sm font-semibold text-amber-700">Client</p><h2 className="text-2xl font-extrabold">{t.clientInfo}</h2></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t.clientName} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder={t.clientAddress} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder={t.clientPhone} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder={t.clientEmail} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /></div>
          </section>

          <section className="rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-3 text-xl">🏢</div><div><p className="text-sm font-semibold text-amber-700">Entreprise</p><h2 className="text-2xl font-extrabold">{t.businessInfo}</h2></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t.businessName} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder={t.businessAddress} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><input type="tel" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder={t.businessPhone} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder={t.businessEmail} className="rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><div className="sm:col-span-2"><div className="flex gap-2"><input value={businessSiret} onChange={(e) => { setBusinessSiret(e.target.value); setCompanyLookupStatus(""); }} placeholder={t.businessSiret} className="min-w-0 flex-1 rounded-xl border border-orange-100 bg-[#fff9f3] p-3" /><button type="button" onClick={() => void lookupCompany()} className="rounded-xl bg-amber-600 px-4 py-3 font-semibold text-white">{companyLookupStatus === "loading" ? "..." : t.lookupCompany}</button></div>{companyLookupStatus === "found" && <p className="mt-2 text-sm font-semibold text-green-600">✓ {t.companyFound}</p>}{companyLookupStatus === "notfound" && <p className="mt-2 text-sm font-semibold text-red-600">{t.companyNotFound}</p>}</div></div>
          </section>

          <section id="settings-section" className="scroll-mt-6 rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-3 text-xl">💶</div><div><p className="text-sm font-semibold text-amber-700">Tarification</p><h2 className="text-2xl font-extrabold">{t.pricing}</h2></div></div>
            <label className="text-sm font-semibold">TVA<select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-orange-100 bg-[#fff9f3] p-3"><option value={0}>0%</option><option value={5.5}>5.5%</option><option value={10}>10%</option><option value={20}>20%</option></select></label>
            <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[#fff9f3] p-4"><p className="text-sm text-stone-500">{t.materials}</p><p className="mt-1 text-2xl font-bold">{materialFromServices.toFixed(2)} €</p></div><div className="rounded-2xl bg-[#fff9f3] p-4"><p className="text-sm text-stone-500">{t.laborTotal}</p><p className="mt-1 text-2xl font-bold">{laborFromServices.toFixed(2)} €</p></div></div>
            <div className="mt-4 rounded-2xl bg-[#f8efe5] p-5"><div className="flex justify-between"><span>HT</span><b>{totalHT.toFixed(2)} €</b></div><div className="mt-2 flex justify-between"><span>TVA ({vatRate}%)</span><b>{vatAmount.toFixed(2)} €</b></div><div className="mt-3 flex items-center justify-between border-t pt-3"><span className="text-lg font-bold">TTC</span><span className="text-3xl font-black">{totalTTC.toFixed(2)} €</span></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void saveDocumentToDatabase()} className="rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-700">{selectedDocumentId ? t.updateDocument : t.saveDocument}</button><button type="button" onClick={createPdf} className="rounded-xl bg-stone-800 px-5 py-4 font-bold text-white hover:bg-stone-700">{t.createPdf}</button></div>
          </section>

          <section className="rounded-3xl border border-orange-100 bg-[#fffdf9] p-6 shadow-[0_10px_30px_rgba(120,72,24,0.08)]">
            <h2 className="text-center text-2xl font-bold">{t.plans}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">{(["free", "pro", "business"] as Plan[]).map((p) => <div key={p} className={`rounded-2xl border p-5 transition ${p === "pro" ? "border-amber-400 bg-gradient-to-b from-amber-50 to-[#fffdf9] shadow-[0_12px_30px_rgba(217,119,6,0.12)] ring-1 ring-amber-300" : "border-orange-100 bg-[#fffdf9]"}`}><h3 className="text-xl font-bold">{p === "free" ? t.free : p === "pro" ? t.pro : t.business}</h3><p className="mt-2 text-3xl font-black">{p === "free" ? "0 €" : p === "pro" ? "9,99 €" : "19,99 €"}</p><p className="mt-3 text-sm text-stone-500">{p === "business" ? t.unlimited : `${PLAN_LIMITS[p]} AI / mois`}</p><button type="button" disabled className="mt-5 w-full rounded-xl border border-orange-100 bg-[#fff9f3] p-3 text-sm font-semibold text-stone-500">{t.paymentSoon}</button></div>)}</div>
          </section>

          <footer className="pb-4 pt-2 text-center text-sm text-stone-500">
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              <a href="/pricing" className="hover:text-amber-700">Tarifs</a>
              <a href="/terms" className="hover:text-amber-700">Conditions d’utilisation</a>
              <a href="/privacy" className="hover:text-amber-700">Confidentialité</a>
              <a href="/refund" className="hover:text-amber-700">Remboursements</a>
              <a href="/cookies" className="hover:text-amber-700">Cookies</a>
              <a href="/mentions-legales" className="hover:text-amber-700">Mentions légales</a>
              <a href="/contact" className="hover:text-amber-700">Contact</a>
            </div>
            <p className="mt-3 text-xs">© {new Date().getFullYear()} ALEK. Tous droits réservés.</p>
          </footer>
        </div>
      </div>
    </main>
  );
} 