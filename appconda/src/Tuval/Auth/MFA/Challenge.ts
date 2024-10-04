import { Document } from '@tuval/core'; // Replace with actual package

export abstract class Challenge {
     static verify(user: Document, otp: string): boolean {
        return false;
     }
     static challenge(challenge: Document, user: Document, otp: string): boolean{
        return false;
     }
}
