import { useAuth } from '../../contexts/AuthContext';
import { useAccount } from '../account/AccountContext';
import { AccountPageHeader } from '../account/AccountLayout';
import AnalysisQueue from '../../components/analysis/AnalysisQueue';

// Coach Dashboard → Video Analysis: the game film assigned to the coach (an
// admin without a coach profile sees every analysis).

const CoachVideoAnalysisPage = () => {
  const { user } = useAuth();
  const { isCoach, isAdmin } = useAccount();
  const adminView = isAdmin && !isCoach;

  return (
    <div>
      <AccountPageHeader title="Video Analysis" />
      <p className="-mt-5 mb-6 text-gray-500 text-sm">
        {adminView ? 'Every video analysis, for every coach.' : 'Game film assigned to you. Each is due 7 days after the family uploads it.'}
      </p>
      <AnalysisQueue coachUserId={user?.$id} admin={adminView} />
    </div>
  );
};

export default CoachVideoAnalysisPage;
