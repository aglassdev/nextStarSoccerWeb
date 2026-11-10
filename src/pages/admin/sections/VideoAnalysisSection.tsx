import { Link } from 'react-router-dom';
import AnalysisQueue from '../../../components/analysis/AnalysisQueue';

// Every online video analysis and the coach the customer chose. Opening one
// goes to the coach workspace, where admins can annotate and complete it too.
const VideoAnalysisSection = () => (
  <div className="p-6 space-y-5">
    <div className="flex justify-end">
      <Link to="/coach/video-analysis" className="text-white text-xs opacity-50 hover:opacity-100 transition-opacity">Open coach dashboard →</Link>
    </div>
    <AnalysisQueue admin />
  </div>
);

export default VideoAnalysisSection;
