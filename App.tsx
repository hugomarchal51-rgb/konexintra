import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList, Clock3, FileText, Inbox, LayoutDashboard, LogOut, Mail, Menu, MoveHorizontal as MoreHorizontal, Plus, Search, Settings as SettingsIcon, Sparkles, TrendingUp, Users, WalletCards, X, Trash2, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { SettingsModal } from '@/components/SettingsModal';
import { OperatorView } from '@/components/OperatorView';

type NavItem = { label: string; icon: typeof LayoutDashboard; badge?: number; section?: string };
type DocumentItem = { id: string; title: string; kind: 'Devis' | 'Facture'; client: string; amount: number; status: string; date: string };
type RevenuePoint = { id?: string; month: string; amount: number };
type EmailItem = { id: string; sender: string; sender_email: string; subject: string; body: string; is_read: boolean; is_urgent: boolean; category: string; received_at: string };
type TaskItem = { id: string; title: string; description: string; priority: string; status: string; due_date: string | null; created_at: string };

const navItems: NavItem[] = [
  { label: 'Vue d’ensemble', icon: LayoutDashboard },
  { label: 'IA Operator', icon: Sparkles, section: 'Assistant' },
  { label: 'Emails', icon: Mail },
  { label: 'Contacts', icon: Users },
  { label: 'Calendrier', icon: CalendarDays },
  { label: 'Documents', icon: FileText, section: 'Opérations' },
  { label: 'Finances', icon: CircleDollarSign },
  { label: 'Tâches', icon: ClipboardList },
];

const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

const getInitials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??';

function AppInner() {
  const { user, profile, loading, signOut } = useAuth();
  const [activeNav, setActiveNav] = useState('Vue d’ensemble');
  const [showComposer, setShowComposer] = useState(false);
  const [composerKind, setComposerKind] = useState<'Devis' | 'Facture'>('Devis');
  const [toast, setToast] = useState('');
  const [documentList, setDocumentList] = useState<DocumentItem[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [emailList, setEmailList] = useState<EmailItem[]>([]);
  const [taskList, setTaskList] = useState<TaskItem[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const displayName = profile?.full_name || 'Nathan Morel';
  const firstName = displayName.split(' ')[0];
  const initials = getInitials(displayName);
  const company = profile?.company || 'Studio indépendant';

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    const [docsRes, revRes, emailRes, taskRes] = await Promise.all([
      supabase.from('operator_items').select('payload').eq('kind', 'document').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('revenue_series').select('id, month, amount').order('created_at', { ascending: true }),
      supabase.from('emails').select('*').order('received_at', { ascending: false }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    ]);
    const savedDocs = (docsRes.data || []).map((r) => r.payload as DocumentItem).filter((d) => d && d.id);
    setDocumentList(savedDocs);
    if (revRes.data) setRevenue(revRes.data as RevenuePoint[]);
    if (emailRes.data) setEmailList(emailRes.data as EmailItem[]);
    if (taskRes.data) setTaskList(taskRes.data as TaskItem[]);
  }, [user]);

  useEffect(() => { void loadData(); }, [loadData]);

  const createDocument = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const client = String(form.get('client') || 'Nouveau client');
    const amount = Number(form.get('amount') || 0);
    const next: DocumentItem = { id: `${composerKind === 'Devis' ? 'D' : 'F'}-${Math.floor(1000 + Math.random() * 8999)}`, title: String(form.get('title') || 'Nouvelle prestation'), kind: composerKind, client, amount, status: composerKind === 'Devis' ? 'À envoyer' : 'Brouillon', date: 'À l’instant' };
    setDocumentList((current) => [next, ...current]);
    setShowComposer(false);
    setToast(`${composerKind} créé pour ${client}`);
    if (supabase) void supabase.from('operator_items').insert({ kind: 'document', title: next.title, payload: next });
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"><Sparkles size={32} /></div></div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  const docCount = documentList.length;
  const factures = documentList.filter((d) => d.kind === 'Facture');
  const devis = documentList.filter((d) => d.kind === 'Devis');
  const pendingFactures = factures.filter((f) => f.status !== 'Payée');
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const aEncaisser = pendingFactures.reduce((sum, f) => sum + f.amount, 0);
  const unreadEmails = emailList.filter((e) => !e.is_read);
  const pendingTasks = taskList.filter((t) => t.status === 'pending');

  const navItemsWithBadges = navItems.map((item) => {
    if (item.label === 'Documents') return { ...item, badge: docCount > 0 ? docCount : undefined };
    if (item.label === 'Emails') return { ...item, badge: unreadEmails.length > 0 ? unreadEmails.length : undefined };
    if (item.label === 'Tâches') return { ...item, badge: pendingTasks.length > 0 ? pendingTasks.length : undefined };
    return item;
  });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><span>Konekt</span><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
        <div className="workspace-switcher"><div className="avatar avatar-violet">{initials[0] || 'N'}</div><div><strong>{displayName}</strong><span>{company}</span></div><ChevronDown size={14} /></div>
        <nav>
          {navItemsWithBadges.map((item) => <div key={item.label} className="nav-group">{item.section && <p className="nav-section">{item.section}</p>}<button className={`nav-item ${activeNav === item.label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(item.label); setMobileOpen(false); }}><item.icon size={17} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button></div>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setShowSettings(true)}><SettingsIcon size={17} /><span>Réglages</span></button>
          <div className="plan-card"><div className="plan-top"><span>Plan pro</span><span className="plan-dot" /></div><strong>Votre espace est à jour</strong><div className="plan-line"><span /><span /></div><small>2,4 Go sur 10 Go utilisés</small></div>
          <div className="profile"><div className="avatar avatar-orange">{initials}</div><div><strong>{displayName}</strong><span>{profile?.email_connected ? 'Email connecté' : 'Compte standard'}</span></div><button className="icon-btn" onClick={signOut} title="Déconnexion"><LogOut size={15} /></button></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => { setActiveNav('IA Operator'); }}><Search size={18} /></button>
            <button className="icon-btn notification" onClick={() => setShowSettings(true)}><Bell size={18} /><i /></button>
            <button className="top-avatar" onClick={() => setShowSettings(true)} title="Réglages">{initials}</button>
          </div>
        </header>
        {activeNav === 'IA Operator' ? (
          <OperatorView onAction={(action) => {
            if (action.type === 'create_quote') { setComposerKind('Devis'); setShowComposer(true); setActiveNav('Documents'); }
            else if (action.type === 'create_invoice') { setComposerKind('Facture'); setShowComposer(true); setActiveNav('Documents'); }
            else if (action.type === 'document_created' || action.type === 'revenue_added' || action.type === 'task_created') {
              void loadData();
              if (action.type === 'document_created') setActiveNav('Documents');
              if (action.type === 'revenue_added') setActiveNav('Finances');
              if (action.type === 'task_created') setActiveNav('Tâches');
              if (action.data?.document) {
                const doc = action.data.document as DocumentItem;
                setToast(`${doc.kind} ${doc.id} créé pour ${doc.client}`);
              } else if (action.type === 'revenue_added') {
                setToast('Revenu ajouté avec succès');
              } else if (action.type === 'task_created') {
                setToast('Tâche créée');
              }
            }
            else if (action.type === 'settings') setShowSettings(true);
          }} />
        ) : activeNav === 'Vue d’ensemble' ? (
          <Dashboard
            firstName={firstName}
            documentList={documentList}
            revenue={revenue}
            totalRevenue={totalRevenue}
            aEncaisser={aEncaisser}
            pendingCount={pendingFactures.length}
            docCount={docCount}
            emailConnected={profile?.email_connected || false}
            unreadEmailCount={unreadEmails.length}
            pendingTaskCount={pendingTasks.length}
            onNewAction={() => { setComposerKind('Devis'); setShowComposer(true); }}
            onGoOperator={() => setActiveNav('IA Operator')}
            onGoSettings={() => setShowSettings(true)}
            onGoDocuments={() => setActiveNav('Documents')}
            onGoCalendar={() => setActiveNav('Calendrier')}
            onGoEmails={() => setActiveNav('Emails')}
            onGoTasks={() => setActiveNav('Tâches')}
          />
        ) : activeNav === 'Emails' ? (
          <EmailView emails={emailList} emailConnected={profile?.email_connected || false} onGoSettings={() => setShowSettings(true)} onMarkRead={(id) => {
            if (supabase) void supabase.from('emails').update({ is_read: true }).eq('id', id);
            setEmailList((prev) => prev.map((e) => e.id === id ? { ...e, is_read: true } : e));
          }} />
        ) : activeNav === 'Tâches' ? (
          <TasksView tasks={taskList} onAdd={() => void loadData()} onToggle={(id) => {
            const task = taskList.find((t) => t.id === id);
            if (!task || !supabase) return;
            const newStatus = task.status === 'done' ? 'pending' : 'done';
            void supabase.from('tasks').update({ status: newStatus }).eq('id', id);
            setTaskList((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t));
          }} onDelete={(id) => {
            if (supabase) void supabase.from('tasks').delete().eq('id', id);
            setTaskList((prev) => prev.filter((t) => t.id !== id));
          }} />
        ) : activeNav === 'Finances' ? (
          <FinancesView revenue={revenue} totalRevenue={totalRevenue} onGoSettings={() => setShowSettings(true)} />
        ) : (
          <SectionView activeNav={activeNav} documentList={documentList} onCreate={(kind) => { setComposerKind(kind); setShowComposer(true); }} />
        )}
      </main>
      {showComposer && (
        <div className="modal-backdrop" onClick={() => setShowComposer(false)}>
          <form className="document-modal anim-pop" onSubmit={createDocument} onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">NOUVEAU DOCUMENT</span><h2>Créer un {composerKind.toLowerCase()}</h2></div><button type="button" className="icon-btn" onClick={() => setShowComposer(false)}><X size={18} /></button></div>
            <div className="kind-switch"><button type="button" className={composerKind === 'Devis' ? 'selected' : ''} onClick={() => setComposerKind('Devis')}>Devis</button><button type="button" className={composerKind === 'Facture' ? 'selected' : ''} onClick={() => setComposerKind('Facture')}>Facture</button></div>
            <label>Client<input name="client" required placeholder="Ex. Maison Rivière" /></label>
            <label>Intitulé<input name="title" required placeholder="Ex. Accompagnement mensuel" /></label>
            <label>Montant HT<input name="amount" type="number" min="0" required placeholder="0" /></label>
            <button className="primary-action" type="submit"><Check size={16} /> Créer le document</button>
          </form>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => { setShowSettings(false); void loadData(); }} onToast={setToast} />}
      {toast && <button className="toast anim-slide-up" onClick={() => setToast('')}><Check size={15} /> {toast}</button>}
    </div>
  );
}

function Dashboard({ firstName, documentList, revenue, totalRevenue, aEncaisser, pendingCount, docCount, emailConnected, unreadEmailCount, pendingTaskCount, onNewAction, onGoOperator, onGoSettings, onGoDocuments, onGoCalendar, onGoEmails, onGoTasks }: {
  firstName: string;
  documentList: DocumentItem[];
  revenue: RevenuePoint[];
  totalRevenue: number;
  aEncaisser: number;
  pendingCount: number;
  docCount: number;
  emailConnected: boolean;
  unreadEmailCount: number;
  pendingTaskCount: number;
  onNewAction: () => void;
  onGoOperator: () => void;
  onGoSettings: () => void;
  onGoDocuments: () => void;
  onGoCalendar: () => void;
  onGoEmails: () => void;
  onGoTasks: () => void;
}) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const hasData = docCount > 0 || revenue.length > 0;
  const devis = documentList.filter((d) => d.kind === 'Devis');
  const factures = documentList.filter((d) => d.kind === 'Facture');

  return (
    <div className="content anim-fade-in">
      <div className="page-heading">
        <div><p className="eyebrow">{today}</p><h1>Bonjour {firstName} <span>✦</span></h1><p>{hasData ? 'Voici ce qui mérite votre attention aujourd’hui.' : 'Bienvenue ! Commencez par créer votre premier document ou demandez à l’opérateur IA.'}</p></div>
        <div className="heading-actions"><button className="primary-action" onClick={onNewAction}><Plus size={16} /> Nouvelle action</button></div>
      </div>
      <div className="metric-grid">
        <Metric label="Chiffre d’affaires" value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '0 \u20ac'} meta={revenue.length > 0 ? `${revenue.length} mois` : '—'} sub="cumulé" icon={CircleDollarSign} tone="green" />
        <Metric label="Documents" value={String(docCount)} meta={`${documentList.filter((d) => d.kind === 'Devis').length} devis`} sub={`${documentList.filter((d) => d.kind === 'Facture').length} factures`} icon={FileText} tone="orange" />
        <Metric label="À encaisser" value={aEncaisser > 0 ? formatCurrency(aEncaisser) : '0 \u20ac'} meta={pendingCount > 0 ? `${pendingCount} factures` : 'à jour'} sub="en attente" icon={WalletCards} tone="blue" />
        <Metric label="Email" value={emailConnected ? `${unreadEmailCount} non lus` : 'Non'} meta={emailConnected ? 'Actif' : 'Déconnecté'} sub={emailConnected ? 'opérateur actif' : 'voir réglages'} icon={Mail} tone={emailConnected ? 'green' : 'violet'} />
      </div>
      <div className="dashboard-grid">
        <div className="left-column">
          <div className="section-card revenue-chart-card">
            <div className="card-heading"><div><h3>Évolution du CA</h3><p>{revenue.length > 0 ? `Chiffre d’affaires mensuel sur ${revenue.length} mois` : 'Aucune donnée pour le moment'}</p></div>{revenue.length > 0 && <div className="chart-trend"><TrendingUp size={14} /> {totalRevenue > 0 ? '+' + Math.round((totalRevenue / Math.max(revenue.length, 1))) + ' \u20ac/mois' : ''}</div>}</div>
            <RevenueChart data={revenue} />
          </div>
          <div className="section-card agenda-card">
            <div className="card-heading"><div><h3>Votre journée</h3><p>3 rendez-vous et {pendingTaskCount} action{pendingTaskCount > 1 ? 's' : ''} prioritaire{pendingTaskCount > 1 ? 's' : ''}</p></div><button className="text-action" onClick={onGoCalendar}>Voir le calendrier <ArrowUpRight size={13} /></button></div>
            <div className="agenda-item"><span className="agenda-time">09:30</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Point stratégie</strong><span>avec Camille Laurent</span></div><b className="tag tag-blue">Dans 25 min</b></div></div>
            <div className="agenda-item"><span className="agenda-time">13:00</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Validation du devis</strong><span>avec Maison Rivière</span></div><b className="tag tag-grey">Google Meet</b></div></div>
            <div className="agenda-item"><span className="agenda-time">16:30</span><div className="agenda-line"><i /></div><div className="agenda-content"><div><strong>Focus création</strong><span>Bloc de temps personnel</span></div><b className="tag tag-grey">2h</b></div></div>
          </div>
          <div className="section-card attention-card">
            <div className="card-heading"><div><h3>À traiter maintenant</h3><p>L’opérateur peut vous aider</p></div><button className="text-action" onClick={onGoOperator}>Demander à l’IA <ArrowUpRight size={13} /></button></div>
            {emailConnected ? (
              <Attention icon="mail" title={unreadEmailCount > 0 ? `${unreadEmailCount} email${unreadEmailCount > 1 ? 's' : ''} non lu${unreadEmailCount > 1 ? 's' : ''}` : 'Boîte mail à jour'} detail={unreadEmailCount > 0 ? 'L’opérateur peut lire et trier vos messages' : 'Tous vos messages sont lus'} action="Ouvrir les emails" onClick={onGoEmails} />
            ) : (
              <Attention icon="mail" title="Connecter votre Gmail" detail="Permettez à l’IA de gérer vos emails" action="Voir les réglages" onClick={onGoSettings} />
            )}
            {pendingCount > 0 && (
              <Attention icon="file" title={`Relancer ${pendingCount} facture${pendingCount > 1 ? 's' : ''}`} detail="Échéance dépassée" action="Voir les factures" onClick={onGoDocuments} />
            )}
            {pendingTaskCount > 0 && (
              <Attention icon="spark" title={`${pendingTaskCount} tâche${pendingTaskCount > 1 ? 's' : ''} en cours`} detail="L’opérateur peut les gérer" action="Voir les tâches" onClick={onGoTasks} />
            )}
            <Attention icon="spark" title="Préparer votre réunion" detail="Brief disponible pour le point de 13:00" action="Ouvrir le brief" onClick={onGoOperator} />
          </div>
        </div>
        <div className="right-column">
          <div className="section-card pipeline-card">
            <div className="card-heading"><div><h3>Pipeline commercial</h3><p>{docCount > 0 ? `${docCount} document${docCount > 1 ? 's' : ''} actif${docCount > 1 ? 's' : ''}` : 'Aucun document'}</p></div><button className="icon-btn"><MoreHorizontal size={17} /></button></div>
            <div className="pipeline-total"><strong>{docCount > 0 ? formatCurrency(documentList.reduce((s, d) => s + d.amount, 0)) : '0 \u20ac'}</strong><span>valeur totale</span></div>
            <div className="pipeline-bars">
              <Bar label="Devis" value={formatCurrency(devis.reduce((s, d) => s + d.amount, 0))} width={`${devis.length > 0 ? Math.min((devis.length / Math.max(docCount, 1)) * 100, 100) : 0}%`} color="blue" />
              <Bar label="Factures" value={formatCurrency(factures.reduce((s, d) => s + d.amount, 0))} width={`${factures.length > 0 ? Math.min((factures.length / Math.max(docCount, 1)) * 100, 100) : 0}%`} color="orange" />
            </div>
            <button className="wide-action" onClick={onGoDocuments}>Voir les documents <ArrowUpRight size={14} /></button>
          </div>
          <div className="section-card activity-card">
            <div className="card-heading"><div><h3>Activité récente</h3><p>Vos derniers documents</p></div></div>
            {documentList.length > 0 ? documentList.slice(0, 4).map((doc, i) => (
              <div key={doc.id} className="activity-row"><div className={`activity-icon activity-${i % 3}`}>{doc.kind === 'Devis' ? <FileText size={13} /> : <CircleDollarSign size={13} />}</div><div><strong>{doc.id}</strong><span>{doc.kind} pour {doc.client}</span></div><small>{doc.date}</small></div>
            )) : (
              <div className="activity-row"><div className="activity-icon activity-0"><Sparkles size={13} /></div><div><strong>Aucune activité</strong><span>Créez votre premier document</span></div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailView({ emails, emailConnected, onGoSettings, onMarkRead }: {
  emails: EmailItem[];
  emailConnected: boolean;
  onGoSettings: () => void;
  onMarkRead: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedEmail = emails.find((e) => e.id === selected);

  if (!emailConnected) {
    return (
      <div className="content anim-fade-in">
        <div className="page-heading"><div><p className="eyebrow">MESSAGERIE</p><h1>Emails</h1><p>Gérez vos emails avec l'aide de l'IA.</p></div></div>
        <div className="empty-state">
          <div className="empty-icon"><Mail size={24} /></div>
          <h2>Gmail non connecté</h2>
          <p>Connectez votre compte Gmail dans les réglages pour permettre à l'opérateur IA de lire, trier et préparer vos réponses.</p>
          <button className="primary-action" onClick={onGoSettings} style={{ marginTop: '16px' }}><Mail size={16} /> Connecter Gmail</button>
        </div>
      </div>
    );
  }

  return (
    <div className="content anim-fade-in">
      <div className="page-heading"><div><p className="eyebrow">MESSAGERIE</p><h1>Emails</h1><p>{emails.length} message{emails.length > 1 ? 's' : ''} au total</p></div></div>
      <div className="email-layout">
        <div className="email-list-panel">
          {emails.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><Mail size={24} /></div><h2>Aucun email</h2><p>Votre boîte de réception est vide.</p></div>
          ) : (
            emails.map((email) => (
              <div key={email.id} className={`email-row ${!email.is_read ? 'unread' : ''} ${selected === email.id ? 'selected' : ''}`} onClick={() => { setSelected(email.id); if (!email.is_read) onMarkRead(email.id); }}>
                <div className="email-row-avatar">{email.sender[0]}</div>
                <div className="email-row-content">
                  <div className="email-row-top"><strong>{email.sender}</strong>{email.is_urgent && <b className="tag tag-urgent">Urgent</b>}</div>
                  <span className="email-row-subject">{email.subject}</span>
                  <span className="email-row-preview">{email.body.slice(0, 60)}...</span>
                </div>
                {!email.is_read && <span className="email-unread-dot" />}
              </div>
            ))
          )}
        </div>
        {selectedEmail && (
          <div className="email-detail-panel anim-fade-in">
            <div className="email-detail-header">
              <div className="email-detail-avatar">{selectedEmail.sender[0]}</div>
              <div><strong>{selectedEmail.sender}</strong><span>{selectedEmail.sender_email}</span></div>
            </div>
            <h2 className="email-detail-subject">{selectedEmail.subject}</h2>
            <div className="email-detail-meta">
              <span className={`tag ${selectedEmail.is_urgent ? 'tag-urgent' : 'tag-grey'}`}>{selectedEmail.is_urgent ? 'Urgent' : 'Normal'}</span>
              <span className="email-detail-date">{new Date(selectedEmail.received_at).toLocaleString('fr-FR')}</span>
            </div>
            <p className="email-detail-body">{selectedEmail.body}</p>
            <div className="email-detail-actions">
              <button className="primary-action"><Mail size={15} /> Préparer une réponse</button>
              <button className="secondary-action"><Sparkles size={15} /> Demander à l'IA</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TasksView({ tasks, onAdd, onToggle, onDelete }: {
  tasks: TaskItem[];
  onAdd: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newTask, setNewTask] = useState('');
  const { user } = useAuth();

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || !newTask.trim()) return;
    const { data } = await supabase.from('tasks').insert({ user_id: user.id, title: newTask.trim(), priority: 'medium', status: 'pending' }).select('*').single();
    if (data) {
      setNewTask('');
      onAdd();
    }
  };

  return (
    <div className="content anim-fade-in">
      <div className="page-heading"><div><p className="eyebrow">PRODUCTIVITÉ</p><h1>Tâches</h1><p>{tasks.filter((t) => t.status === 'pending').length} tâche{tasks.filter((t) => t.status === 'pending').length > 1 ? 's' : ''} en cours</p></div></div>
      <div className="section-card full-list">
        <form className="task-add-form" onSubmit={addTask}>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Ajouter une tâche..." />
          <button type="submit" className="primary-action"><Plus size={15} /> Ajouter</button>
        </form>
        <div className="task-list">
          {tasks.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><ClipboardList size={24} /></div><h2>Aucune tâche</h2><p>Ajoutez une tâche ou demandez à l'opérateur IA de le faire pour vous.</p></div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className={`task-row ${task.status === 'done' ? 'task-done' : ''}`}>
                <button className="task-check" onClick={() => onToggle(task.id)}>
                  {task.status === 'done' && <Check size={14} />}
                </button>
                <div className="task-content">
                  <strong>{task.title}</strong>
                  {task.description && <span>{task.description}</span>}
                </div>
                <span className={`task-priority priority-${task.priority}`}>{task.priority}</span>
                <button className="icon-btn" onClick={() => onDelete(task.id)}><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FinancesView({ revenue, totalRevenue, onGoSettings }: {
  revenue: RevenuePoint[];
  totalRevenue: number;
  onGoSettings: () => void;
}) {
  const avg = revenue.length > 0 ? Math.round(totalRevenue / revenue.length) : 0;
  const maxMonth = revenue.length > 0 ? revenue.reduce((max, r) => r.amount > max.amount ? r : max, revenue[0]) : null;
  const minMonth = revenue.length > 0 ? revenue.reduce((min, r) => r.amount < min.amount ? r : min, revenue[0]) : null;

  return (
    <div className="content anim-fade-in">
      <div className="page-heading"><div><p className="eyebrow">FINANCES</p><h1>Finances</h1><p>Suivez l'évolution de votre chiffre d'affaires</p></div><div className="heading-actions"><button className="secondary-action" onClick={onGoSettings}><TrendingUp size={15} /> Gérer le CA</button></div></div>
      <div className="metric-grid">
        <Metric label="CA total" value={totalRevenue > 0 ? formatCurrency(totalRevenue) : '0 \u20ac'} meta={revenue.length > 0 ? `${revenue.length} mois` : '—'} sub="cumulé" icon={CircleDollarSign} tone="green" />
        <Metric label="Moyenne mensuelle" value={avg > 0 ? formatCurrency(avg) : '0 \u20ac'} meta="par mois" sub="moyenne" icon={TrendingUp} tone="blue" />
        <Metric label="Meilleur mois" value={maxMonth ? formatCurrency(maxMonth.amount) : '0 \u20ac'} meta={maxMonth?.month || '—'} sub="record" icon={ArrowUpRight} tone="orange" />
        <Metric label="Mois le plus bas" value={minMonth ? formatCurrency(minMonth.amount) : '0 \u20ac'} meta={minMonth?.month || '—'} sub="minimum" icon={WalletCards} tone="violet" />
      </div>
      <div className="section-card revenue-chart-card">
        <div className="card-heading"><div><h3>Évolution détaillée du CA</h3><p>{revenue.length > 0 ? `${revenue.length} mois de données` : 'Aucune donnée'}</p></div></div>
        <RevenueChart data={revenue} />
      </div>
      <div className="section-card full-list">
        <div className="card-heading"><div><h3>Détail par mois</h3><p>{revenue.length > 0 ? `${revenue.length} mois` : 'Aucune donnée'}</p></div></div>
        {revenue.length > 0 ? (
          <div className="revenue-detail-list">
            {revenue.map((r, i) => (
              <div key={r.id || i} className="revenue-detail-row">
                <span className="revenue-month">{r.month}</span>
                <div className="revenue-bar-track"><div className="revenue-bar-fill" style={{ width: `${Math.min((r.amount / Math.max(1, ...revenue.map((rev) => rev.amount))) * 100, 100)}%` }} /></div>
                <strong className="revenue-amount">{formatCurrency(r.amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon"><CircleDollarSign size={24} /></div><h2>Aucune donnée financière</h2><p>Ajoutez vos revenus mensuels via les réglages ou demandez à l'IA de le faire.</p></div>
        )}
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const chartData = useMemo(() => data.length > 0 ? data : [], [data]);

  if (chartData.length === 0) {
    return <div className="revenue-chart"><div className="chart-empty"><Sparkles size={20} /><p>Aucune donnée de chiffre d’affaires pour le moment</p></div></div>;
  }

  const max = Math.max(...chartData.map((d) => d.amount), 1);
  const width = 100;
  const height = 100;
  const step = width / Math.max(chartData.length - 1, 1);
  const points = chartData.map((d, i) => ({ x: i * step, y: height - (d.amount / max) * (height - 10) - 5 }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="revenue-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b72e8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#9b72e8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#revGrad)" className="chart-area" />
        <path d={linePath} fill="none" stroke="#9b72e8" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.2" fill="#9b72e8" className="chart-dot" style={{ animationDelay: `${i * 80}ms` }} />)}
      </svg>
      <div className="chart-labels">{chartData.map((d) => <span key={d.month}>{d.month}</span>)}</div>
    </div>
  );
}

function Metric({ label, value, meta, sub, icon: Icon, tone }: { label: string; value: string; meta: string; sub: string; icon: typeof CircleDollarSign; tone: string }) {
  return <div className="metric-card anim-card"><div className={`metric-icon ${tone}`}><Icon size={17} /></div><span className="metric-label">{label}</span><strong>{value}</strong><div className="metric-meta"><b className={tone}>{meta}</b><span>{sub}</span></div></div>;
}
function Attention({ icon, title, detail, action, onClick }: { icon: string; title: string; detail: string; action: string; onClick: () => void }) {
  return <div className="attention-row"><div className={`attention-icon ${icon}`}>{icon === 'mail' ? <Mail size={15} /> : icon === 'file' ? <FileText size={15} /> : <Sparkles size={15} />}</div><div className="attention-copy"><strong>{title}</strong><span>{detail}</span></div><button onClick={onClick}>{action}<ChevronRight size={13} /></button></div>;
}
function Bar({ label, value, width, color }: { label: string; value: string; width: string; color: string }) {
  return <div className="bar-row"><div><span>{label}</span><b>{value}</b></div><div className="bar-track"><i className={color} style={{ width }} /></div></div>;
}
function SectionView({ activeNav, documentList, onCreate }: { activeNav: string; documentList: DocumentItem[]; onCreate: (kind: 'Devis' | 'Facture') => void }) {
  const isDocs = activeNav === 'Documents' || activeNav === 'Finances';
  return <div className="content anim-fade-in"><div className="page-heading"><div><p className="eyebrow">ESPACE DE TRAVAIL</p><h1>{activeNav}</h1><p>{isDocs ? 'Gérez vos devis et factures.' : 'Centralisez les informations et laissez l’opérateur vous aider.'}</p></div><div className="heading-actions">{isDocs && <><button className="secondary-action" onClick={() => onCreate('Facture')}><FileText size={15} /> Nouvelle facture</button><button className="primary-action" onClick={() => onCreate('Devis')}><Plus size={16} /> Nouveau devis</button></>}</div></div><div className="section-card full-list"><div className="card-heading"><div><h3>{isDocs ? 'Documents' : 'Vue de ' + activeNav.toLowerCase()}</h3><p>{isDocs ? documentList.length > 0 ? `${documentList.length} document${documentList.length > 1 ? 's' : ''}` : 'Aucun document pour le moment' : 'Cette vue sera pilotée par vos prochaines demandes.'}</p></div></div>{isDocs ? documentList.length > 0 ? documentList.map((document) => <div className="document-row" key={document.id}><div className={`document-icon ${document.kind === 'Devis' ? 'doc-blue' : 'doc-orange'}`}><FileText size={18} /></div><div className="document-name"><strong>{document.title}</strong><span>{document.id} · {document.client}</span></div><span className="document-kind">{document.kind}</span><strong className="document-amount">{formatCurrency(document.amount)}</strong><span className={`status ${document.status === 'Payée' ? 'status-paid' : document.status === 'À envoyer' ? 'status-ready' : 'status-pending'}`}>{document.status}</span><button className="icon-btn"><MoreHorizontal size={17} /></button></div>) : <div className="empty-state"><div className="empty-icon"><FileText size={24} /></div><h2>Aucun document</h2><p>Créez votre premier devis ou facture, ou demandez à l’opérateur IA de le faire pour vous.</p></div> : <div className="empty-state"><div className="empty-icon"><Sparkles size={24} /></div><h2>Demandez à l’opérateur</h2><p>Il peut retrouver une information, préparer une réponse ou lancer une action pour vous.</p></div>}</div></div>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  return <AppInner />;
}
