import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WantlistItem } from '../types';
import { Squares2x2Icon } from '../components/icons/Squares2x2Icon';
import { QueueListIcon } from '../components/icons/QueueListIcon';
import WantlistGrid from '../components/WantlistGrid';
import WantlistTable from '../components/WantlistTable';

interface WantlistViewProps {
    wantlist: WantlistItem[];
    onRequestEdit: (item: WantlistItem) => void;
    onDelete: (id: string) => void;
    onMoveToCollection: (item: WantlistItem) => void;
}

const WANTLIST_VIEW_MODE_KEY = 'disco_wantlist_view_mode';

const WantlistView: React.FC<WantlistViewProps> = ({ wantlist, onRequestEdit, onDelete, onMoveToCollection }) => {
    const [view, setView] = useState<'grid' | 'list'>(() => {
        const storedView = localStorage.getItem(WANTLIST_VIEW_MODE_KEY);
        return storedView === 'grid' ? 'grid' : 'list';
    });
    
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        localStorage.setItem(WANTLIST_VIEW_MODE_KEY, view);
    }, [view]);

    useEffect(() => {
        const { editWantlistItemId } = location.state || {};
        let stateWasHandled = false;

        if (editWantlistItemId) {
            const item = wantlist.find(i => i.id === editWantlistItemId);
            if (item) {
                onRequestEdit(item);
                stateWasHandled = true;
            }
        }

        if (stateWasHandled) {
            navigate(location.pathname, { replace: true, state: {} });
        }
  }, [location.state, wantlist, navigate, onRequestEdit]);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-zinc-800">My Wantlist</h1>
                <div className="flex items-center gap-1 p-1 bg-zinc-200 rounded-lg">
                    <button
                        onClick={() => setView('grid')}
                        className={`p-1.5 rounded-md ${view === 'grid' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        aria-label="Grid View"
                        title="Grid View"
                    >
                        <Squares2x2Icon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setView('list')}
                        className={`p-1.5 rounded-md ${view === 'list' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        aria-label="List View"
                        title="List View"
                    >
                        <QueueListIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {view === 'grid' ? (
                <WantlistGrid 
                    wantlist={wantlist}
                    onRequestEdit={onRequestEdit}
                    onDelete={onDelete}
                    onMoveToCollection={onMoveToCollection}
                />
            ) : (
                <WantlistTable
                    wantlist={wantlist}
                    onRequestEdit={onRequestEdit}
                    onDelete={onDelete}
                    onMoveToCollection={onMoveToCollection}
                />
            )}
        </div>
    );
};

export default WantlistView;