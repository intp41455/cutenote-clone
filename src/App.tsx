import Header from './components/Header';
import Hero from './components/Hero';
import RecentNotes from './components/RecentNotes';
import Footer from './components/Footer';
import PricingPage from './components/PricingPage';
import AISkillPage from './components/AISkillPage';
import ExplorePage from './components/ExplorePage';
import NoteDetailPage from './components/NoteDetailPage';
import NoteEditor from './components/NoteEditor';
import MyNotes from './components/MyNotes';
import { useHashRoute } from './lib/router';
import './App.css';

function App() {
  const [route, navigate] = useHashRoute();

  const renderPage = () => {
    switch (route.page) {
      case 'ai-skill':
        return <AISkillPage />;
      case 'pricing':
        return <PricingPage />;
      case 'explore':
        return <ExplorePage />;
      case 'my-notes':
        return <MyNotes onNavigate={navigate} />;
      case 'new-note':
        return <NoteEditor onNavigate={navigate} />;
      case 'edit-note':
        return <NoteEditor id={route.id} onNavigate={navigate} />;
      case 'note':
        return <NoteDetailPage id={route.id} onNavigate={navigate} />;
      default:
        return (
          <>
            <Hero onNoteCreated={(id) => navigate({ page: 'note', id })} />
            <RecentNotes />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header route={route} onNavigate={navigate} />
      <main className="flex-1">{renderPage()}</main>
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default App;
