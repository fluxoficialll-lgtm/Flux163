
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postService } from '../services/postService';
import { authService } from '../services/authService';
import { Post, PollOption } from '../types';

export const CreatePoll: React.FC = () => {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']); // Start with 2 empty options
  const [duration, setDuration] = useState('24 Horas');
  const [isCreateDisabled, setIsCreateDisabled] = useState(true);

  // Load user info
  const currentUser = authService.getCurrentUser();
  const username = currentUser?.profile?.name ? `@${currentUser.profile.name}` : "@usuario";
  const avatar = currentUser?.profile?.photoUrl || "https://randomuser.me/api/portraits/men/32.jpg";

  useEffect(() => {
    const questionFilled = question.trim().length > 0;
    const filledOptionsCount = options.filter(opt => opt.trim().length > 0).length;
    
    // Enable if question is filled AND at least 2 options are filled
    setIsCreateDisabled(!(questionFilled && filledOptionsCount >= 2));
  }, [question, options]);

  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    } else {
      alert('Máximo de 5 opções atingido.');
    }
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleDurationClick = () => {
    const current = duration;
    let newDuration;

    if (current === '24 Horas') {
        newDuration = '7 Dias';
    } else if (current === '7 Dias') {
        newDuration = '30 Dias';
    } else {
        newDuration = '24 Horas';
    }

    setDuration(newDuration);
    alert(`Duração da enquete alterada para: ${newDuration}.`);
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreateDisabled) return;

    const validOptions = options.filter(opt => opt.trim().length > 0);
    
    const pollOptionsData: PollOption[] = validOptions.map(opt => ({
        text: opt,
        votes: 0
    }));

    // Fix: Added missing authorId
    const newPost: Post = {
        id: Date.now().toString(),
        type: 'poll',
        authorId: currentUser?.id || '',
        username: username,
        avatar: avatar,
        text: question,
        time: "Agora",
        timestamp: Date.now(),
        isPublic: true,
        views: 0,
        likes: 0,
        comments: 0,
        liked: false,
        pollOptions: pollOptionsData,
        votedOptionIndex: null // Current user hasn't voted yet
    };

    postService.addPost(newPost);
    
    // alert(`Enquete criada: "${question}" com ${validOptions.length} opções e duração de ${duration}.`);
    navigate('/feed');
  };

  return (
    <div className="h-screen flex flex-col overflow-y-auto overflow-x-hidden font-['Inter']" style={{ background: 'radial-gradient(circle at 5% 5%, #0c0f14, #0a0c10)', color: '#fff' }}>
        <style>{`
            * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            
            header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 16px 20px; background: #0c0f14; position: fixed; width: 100%; z-index: 50;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1); top: 0;
            }
            header h1 { font-size: 18px; font-weight: 600; color: #00c2ff; }
            header button {
                background: none; border: none; color: #00c2ff; font-size: 18px; cursor: pointer; transition: 0.3s; padding: 8px;
            }
            header button:hover { color: #fff; }

            #createPollBtn {
                background: #00c2ff; color: #0c0f14; padding: 8px 16px; border-radius: 8px;
                font-weight: bold; font-size: 16px; transition: 0.3s; border: none;
            }
            #createPollBtn:hover { background: #007bff; color: #fff; }
            #createPollBtn:disabled {
                background: rgba(0, 194, 255, 0.2); color: rgba(255, 255, 255, 0.5); cursor: not-allowed; transform: none;
            }

            main { flex-grow: 1; width: 100%; max-width: 600px; margin: 0 auto; padding: 100px 20px 40px 20px; }

            .poll-container {
                background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); margin-bottom: 20px;
            }

            .poll-question {
                width: 100%; min-height: 80px; background: none; border: 2px solid rgba(0, 194, 255, 0.5);
                border-radius: 8px; resize: vertical; color: #fff; font-size: 18px; line-height: 1.4;
                padding: 15px; margin-bottom: 20px; outline: none; transition: border-color 0.3s, box-shadow 0.3s;
            }
            .poll-question:focus { border-color: #00c2ff; box-shadow: 0 0 10px rgba(0, 194, 255, 0.7); }
            .poll-question::placeholder { color: rgba(255, 255, 255, 0.6); font-weight: 500; }

            .poll-option { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
            .poll-option input {
                flex-grow: 1; padding: 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2);
                background: #1a1e24; color: #fff; font-size: 15px; outline: none; transition: border-color 0.2s;
            }
            .poll-option input:focus { border-color: #00c2ff; background: #101317; }

            .remove-option-btn {
                background: none; border: none; color: #ff4d4d; font-size: 20px; cursor: pointer; padding: 5px; transition: 0.2s;
            }
            .remove-option-btn:hover { color: #ff0000; }

            #addOptionBtn {
                display: flex; align-items: center; justify-content: center; width: 100%; padding: 10px;
                border: 2px dashed rgba(0, 194, 255, 0.4); background: rgba(0, 194, 255, 0.05);
                color: #00c2ff; border-radius: 8px; cursor: pointer; transition: 0.3s;
                font-size: 16px; font-weight: bold; gap: 10px;
            }
            #addOptionBtn:hover { background: rgba(0, 194, 255, 0.15); border-color: #00c2ff; }
            #addOptionBtn:disabled { opacity: 0.5; cursor: not-allowed; }

            .options-container { display: flex; flex-direction: column; gap: 15px; }
            .option-item {
                background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 10px;
                display: flex; justify-content: space-between; align-items: center; cursor: pointer;
                transition: 0.3s; border: 1px solid transparent;
            }
            .option-item:hover { background: rgba(0, 194, 255, 0.15); border-color: #00c2ff; }
            .option-item span { font-size: 15px; color: #fff; }
            .option-item i { color: #00c2ff; }
            .duration-selection { font-weight: bold; color: #00c2ff; margin-left: 10px; }
        `}</style>

        <header>
            <button onClick={() => navigate('/create-post')} aria-label="Fechar" role="button"><i className="fa-solid fa-xmark"></i></button>
            <h1>Criar Enquete</h1>
            <button id="createPollBtn" onClick={handleCreatePoll} disabled={isCreateDisabled} role="button">Criar</button>
        </header>

        <main>
            <form id="pollForm" onSubmit={handleCreatePoll}>
                <div className="poll-container">
                    <textarea 
                        id="pollQuestion" 
                        className="poll-question" 
                        placeholder="Qual é o tópico da sua enquete?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                    ></textarea>

                    <div id="optionsContainer">
                        {options.map((opt, index) => (
                            <div className="poll-option" key={index}>
                                <input 
                                    type="text" 
                                    placeholder={`Opção ${index + 1}`} 
                                    maxLength={100} 
                                    value={opt}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                    required 
                                />
                                {options.length > 2 && (
                                    <button 
                                        type="button" 
                                        className="remove-option-btn" 
                                        onClick={() => handleRemoveOption(index)} 
                                        aria-label="Remover opção"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button type="button" id="addOptionBtn" onClick={handleAddOption} disabled={options.length >= 5}>
                        <i className="fa-solid fa-plus-circle"></i> Adicionar Opção
                    </button>
                </div>

                <div className="options-container">
                    <div className="option-item" role="button" onClick={handleDurationClick}>
                        <span>
                            <i className="fa-solid fa-clock"></i> Duração:
                            <span className="duration-selection" id="pollDuration">{duration}</span>
                        </span>
                        <i className="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            </form>
        </main>
    </div>
  );
};
