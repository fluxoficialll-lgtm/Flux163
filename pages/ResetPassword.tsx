import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/Layout';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { authService } from '../services/authService';
import { AuthError } from '../types';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const email = localStorage.getItem('reset_email');

  useEffect(() => {
    if (!email) navigate('/forgot-password');
  }, [email, navigate]);

  const validate = () => {
      if (!password) return "Nova senha obrigatória";
      if (password.length < 6) return AuthError.PASSWORD_TOO_SHORT;
      if (!confirm) return "Confirme sua senha";
      if (password !== confirm) return AuthError.PASSWORDS_DONT_MATCH;
      return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valError = validate();
    if (valError) {
        setError(valError);
        return;
    }

    setLoading(true);
    setError('');
    
    try {
        if (email) {
            await authService.resetPassword(email, password);
            localStorage.removeItem('reset_email'); // Cleanup
            alert("Senha alterada com sucesso!");
            navigate('/');
        }
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const isValid = password.length >= 6 && password === confirm;

  return (
    <AuthLayout title="Redefinir Senha" subtitle="Crie uma nova senha">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input 
          label="Nova Senha" 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
        />
        
        <Input 
          label="Confirmar Senha" 
          type="password" 
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repita a nova senha"
        />

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center">
            {error}
          </div>
        )}

        <Button type="submit" disabled={!isValid} isLoading={loading}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
};