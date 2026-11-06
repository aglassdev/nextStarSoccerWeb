import { Link } from 'react-router-dom';
import AnalysisQueue from '../../../components/analysis/AnalysisQueue';

// Every online video analysis, with the coach each is assigned to. Opening one
// goes to the coach workspace, where admins can annotate and complete it too.
const VideoAnalysisSection = () => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-white text-sm opacity-60">
        Bought on the website. Families upload film from their Account Center; coaches review it within 7 days.
      </p>
      <Link to="/coach" className="text-white text-xs opacity-50 hover:opacity-100">Open coach dashboard →</Link>
    </div>
    <AnalysisQueue admin />
  </div>
);

export default VideoAnalysisSection;
