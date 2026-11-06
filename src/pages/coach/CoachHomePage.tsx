import { useAuth } from '../../contexts/AuthContext';
import { useAccount } from '../account/AccountContext';
import AnalysisQueue from '../../components/analysis/AnalysisQueue';

const CoachHomePage = () => {
  const { user } = useAuth();
  const { profile, isCoach, isAdmin } = useAccount();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  // An admin without a coach profile reviews everything.
  const adminView = isAdmin && !isCoach;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          {greeting}{profile?.firstName ? `, ${profile.firstName.trim()}` : ''}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {adminView ? 'Every video analysis, for every coach.' : 'Game film assigned to you. Each is due 7 days after the family uploads it.'}
        </p>
      </div>
      <AnalysisQueue coachUserId={user?.$id} admin={adminView} />
    </div>
  );
};

export default CoachHomePage;
