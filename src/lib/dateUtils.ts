
// src/lib/dateUtils.ts
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

export const formatNullableDate = (date: Date | Timestamp | undefined | null, includeTime = true): string => {
    if (!date) return 'N/A';
    let dateObj: Date;
    if (date instanceof Timestamp) dateObj = date.toDate();
    else if (typeof date === 'string') dateObj = new Date(date);
    else dateObj = date;
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    return format(dateObj, includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: fr });
};
