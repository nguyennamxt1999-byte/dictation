import React, { useEffect, useState } from 'react';
import { Article } from '../types';
import { getAllArticles } from '../services/storageService';
import { Clock, Calendar, CheckCircle2, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';

interface DashboardProps {
  onSelectArticle: (article: Article) => void;
  onNewUpload: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectArticle, onNewUpload }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const data = await getAllArticles();
      setArticles(data);
    } catch (e) {
      console.error("Failed to load articles", e);
    } finally {
      setLoading(false);
    }
  };

  const isDue = (timestamp: number) => Date.now() >= timestamp;

  const dueArticles = articles.filter(a => isDue(a.nextReview));
  const upcomingArticles = articles.filter(a => !isDue(a.nextReview));

  if (loading) {
      return (
          <div className="flex h-64 items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
      )
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10">
      
      {/* Welcome Section */}
      <div className="flex justify-between items-end pb-6 border-b border-gray-200">
        <div>
            <h2 className="text-3xl font-bold text-gray-900">My Library</h2>
            <p className="text-gray-500 mt-1">Manage your progress and daily reviews.</p>
        </div>
        <button 
            onClick={onNewUpload}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition shadow-md font-medium"
        >
            + Upload New Audio
        </button>
      </div>

      {/* Due For Review Section */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
            <h3 className="text-xl font-bold text-gray-800">Due for Review</h3>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">{dueArticles.length}</span>
        </div>

        {dueArticles.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm text-center">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-gray-800">All caught up!</h4>
                <p className="text-sm text-gray-500">You have no articles pending review for today.</p>
            </div>
        ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dueArticles.map(article => (
                    <div 
                        key={article.id} 
                        onClick={() => onSelectArticle(article)}
                        className="group bg-white p-5 rounded-xl border border-amber-200 hover:border-amber-400 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Clock className="w-16 h-16 text-amber-500" />
                        </div>
                        
                        <h4 className="font-bold text-gray-800 truncate mb-2 pr-6">{article.title}</h4>
                        <div className="flex items-center text-xs text-amber-600 font-medium mb-4">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Due Now
                        </div>
                        
                        <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-100">
                             <div className="text-xs text-gray-500">
                                 Stage {article.stage}
                             </div>
                             <div className="text-indigo-600 font-semibold text-sm flex items-center group-hover:translate-x-1 transition-transform">
                                 Review <ChevronRight className="w-4 h-4" />
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </section>

      {/* All Articles / Upcoming */}
      <section>
         <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-8 bg-gray-300 rounded-full"></div>
            <h3 className="text-xl font-bold text-gray-800">Upcoming Reviews</h3>
        </div>

        {upcomingArticles.length === 0 && articles.length === 0 ? (
             <div className="text-center py-12 text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No articles yet. Upload your first audio file!</p>
             </div>
        ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingArticles.map(article => (
                    <div 
                        key={article.id} 
                        onClick={() => onSelectArticle(article)}
                        className="group bg-white p-5 rounded-xl border border-gray-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                        <h4 className="font-bold text-gray-800 truncate mb-2">{article.title}</h4>
                        <div className="flex items-center text-xs text-gray-500 mb-4">
                            <Calendar className="w-3 h-3 mr-1" />
                            Next: {new Date(article.nextReview).toLocaleDateString()}
                        </div>
                        
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                             {/* Visual representation of stage/mastery */}
                            <div 
                                className="bg-indigo-400 h-1.5 rounded-full" 
                                style={{width: `${Math.min(article.stage * 10, 100)}%`}}
                            ></div>
                        </div>
                        <div className="mt-2 text-right text-xs text-gray-400">Mastery: {Math.min(article.stage * 10, 100)}%</div>
                    </div>
                ))}
            </div>
        )}
      </section>

    </div>
  );
};

export default Dashboard;
