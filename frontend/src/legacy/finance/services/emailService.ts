// @ts-nocheck
import { invokeEdgeFunction } from '../utils/edgeFunctions';

export interface EmailAttachment {
    filename: string;
    content: string; // Base64 string
    contentType: string;
}

export interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    attachments?: EmailAttachment[];
}

export interface EmailResponse {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Sends an email using the 'send-email' Supabase Edge Function.
 * This is the ONLY recommended way to send emails to ensure security.
 */
export const sendEmail = async ({
    to,
    subject,
    html,
    from,
    attachments
}: SendEmailParams, retryCount = 0): Promise<EmailResponse> => {
    try {
        console.log(`EmailService: Sending email to ${to}... (Attempt ${retryCount + 1})`);
        const data = await invokeEdgeFunction('send-email', { to, subject, html, from, attachments });
        if ((data as any)?.error) {
            console.error('Email service error:', (data as any)?.error);
            // Retry once on typical network/timeout errors
            if (retryCount === 0 && (String((data as any)?.error).includes('Fetch') || String((data as any)?.error).includes('timeout'))) {
                console.log('Retrying email send after error...');
                await new Promise(r => setTimeout(r, 2000));
                return sendEmail({ to, subject, html, from, attachments }, 1);
            }
            return { success: false, error: String((data as any)?.error) };
        }

        return { success: true, data };
    } catch (err: any) {
        console.error('Email service invocation failed:', err);
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            return { success: false, error: 'Email request was aborted' };
        }
        return { success: false, error: err.message };
    }
};

/**
 * Helper for bulk emails (comma separated list for the Edge Function)
 */
export const sendBulkEmail = async (
    to: string[],
    subject: string,
    content: string,
    buttonLabel?: string,
    buttonUrl?: string
) => {
    const html = `
        <!DOCTYPE html>
        <html>
            <head>
                <style>
                    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 20px; }
                    .content-box { background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                    .title { color: #111827; font-size: 24px; font-weight: 800; margin-bottom: 16px; }
                    .message { color: #4b5563; font-size: 16px; margin-bottom: 24px; }
                    .button { display: inline-block; background: #8b5cf6; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; }
                    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${window.location.origin}/unnamed-removebg-preview.webp" alt="Hakika Logo" class="logo" />
                    </div>
                    <div class="content-box">
                        <h2 class="title">Property Notification</h2>
                        <div class="message">
                            ${content.split('\n').map(p => `<p>${p}</p>`).join('')}
                        </div>
                        
                        ${buttonLabel && buttonUrl ? `
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${buttonUrl}" class="button">${buttonLabel}</a>
                        </div>
                        ` : ''}
                    </div>
                    <div class="footer">
                        <p>© 2026 Hakika app. All rights reserved.</p>
                        <p>Sent via the Hakika app.</p>
                    </div>
                </div>
            </body>
        </html>
    `;

    return sendEmail({ to, subject, html });
};

/**
 * Predefined email templates for account lifecycle
 */
export const EmailTemplates = {
    accountApproved: (userName: string) => ({
        subject: 'Your Hakika app Account is Approved!',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ec4899;">Hello ${userName},</h2>
                <p>Great news! Your administrative account for <strong>Hakika app</strong> has been reviewed and approved.</p>
                <p>You now have full access to your designated module and management tools.</p>
                <div style="margin: 30px 0;">
                    <a href="${window.location.origin}/portal" style="background-color: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login to Dashboard</a>
                </div>
                <p style="color: #666; font-size: 14px;">If you didn't expect this, please contact support.</p>
            </div>
        `
    }),
    accountRejected: (userName: string, reason?: string) => ({
        subject: 'Update on your Hakika app Access Request',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Hello ${userName},</h2>
                <p>We are unable to approve your high-level access request at this time.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                <p>You may still access standard features, or contact your administrator for clarification.</p>
            </div>
        `
    }),
    subscriptionUpdated: (userName: string, planName: string) => ({
        subject: 'Your Subscription has been Updated',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Subscription Update</h2>
                <p>Hi ${userName}, your account has been successfully transitioned to the <strong>${planName}</strong> plan.</p>
                <p>Thank you for choosing HAKIKA ecosystem.</p>
            </div>
        `
    }),
    credentialsCreated: (userName: string, loginInfo: { email: string, username: string, password?: string }) => ({
        subject: 'Welcome to the Hakika app - Your Access is Ready',
        html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 24px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #ff6a00; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin: 0;">Welcome aboard, ${userName}!</h1>
                </div>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your administrative account has been created. Use the credentials below to log in to the Operations HQ.</p>
                
                <div style="background-color: #f9fafb; padding: 24px; border-radius: 16px; margin: 30px 0; border: 1px solid #f3f4f6;">
                    <div style="margin-bottom: 12px;">
                        <p style="margin: 0; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Username</p>
                        <p style="margin: 2px 0 0 0; color: #111827; font-size: 15px; font-weight: 700;">${loginInfo.username}</p>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <p style="margin: 0; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Email Address</p>
                        <p style="margin: 2px 0 0 0; color: #111827; font-size: 15px; font-weight: 700;">${loginInfo.email}</p>
                    </div>
                    ${loginInfo.password ? `
                    <div>
                        <p style="margin: 0; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                        <p style="margin: 2px 0 0 0; color: #ff6a00; font-size: 15px; font-weight: 800;">${loginInfo.password}</p>
                    </div>` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${window.location.origin}/portal" style="background-color: #ff6a00; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Access Operations HQ</a>
                </div>
                
                <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">Please change your password after your first login for security purposes.</p>
                <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0;" />
                <p style="color: #9ca3af; font-size: 10px; text-align: center; font-weight: 500;">© 2026 Hakika app. All rights reserved.</p>
            </div>
        `
    }),
    leaveApplied: (userName: string, leaveData: { type: string, start: string, end: string, days: number }) => ({
        subject: 'Leave Application Received',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ec4899;">Leave Request Submitted</h2>
                <p>Hello ${userName}, your request for <strong>${leaveData.type}</strong> has been received and is pending approval.</p>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Period:</strong> ${leaveData.start} to ${leaveData.end}</p>
                    <p><strong>Duration:</strong> ${leaveData.days} Days</p>
                </div>
                <p>You will be notified once the request has been reviewed.</p>
            </div>
        `
    }),
    leaveStatusUpdated: (userName: string, status: string, leaveData: { type: string, start: string }) => ({
        subject: `Leave Request ${status.toUpperCase()}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: ${status === 'approved' ? '#10b981' : '#f43f5e'};">Leave Request ${status}</h2>
                <p>Hi ${userName}, your request for <strong>${leaveData.type}</strong> starting on <strong>${leaveData.start}</strong> has been <strong>${status}</strong>.</p>
                <p>Please check your portal for more details.</p>
            </div>
        `
    }),
    shiftAssigned: (userName: string, shiftData: { site: string, shift: string, date: string, time: string }) => ({
        subject: 'New Shift Assignment',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ec4899;">Shift Assignment Notice</h2>
                <p>Hello ${userName}, you have been assigned a new shift.</p>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Site:</strong> ${shiftData.site}</p>
                    <p><strong>Shift:</strong> ${shiftData.shift}</p>
                    <p><strong>Date:</strong> ${shiftData.date}</p>
                    <p><strong>Time:</strong> ${shiftData.time}</p>
                </div>
                <p>Please report to your assigned station on time. Stay safe!</p>
            </div>
        `
    }),
    onboardingCompleted: (userName: string, empNo: string) => ({
        subject: 'Welcome to the Team - Onboarding Complete!',
        html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 24px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #ff6a00; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin: 0;">Welcome to the Team!</h1>
                </div>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">Congratulations! Your onboarding is now complete. We are thrilled to have you as part of the HAKIKA family.</p>
                
                <div style="background-color: #f9fafb; padding: 24px; border-radius: 16px; margin: 30px 0; border: 1px solid #f3f4f6;">
                    <p style="margin: 0; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Registered Employee ID</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: 900;">${empNo}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${window.location.origin}/portal" style="background-color: #ff6a00; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Go to Employee Portal</a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">Your profile is now active. If you have any questions during your first few days, please reach out to the HR department.</p>
                <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0;" />
                <p style="color: #9ca3af; font-size: 10px; text-align: center; font-weight: 500;">© 2026 Hakika app. All rights reserved.</p>
            </div>
        `
    }),
    onboardingInvitation: (inviteLink: string, role: string, companyCode: string) => ({
        subject: 'Invitation to Join the Hakika app',
        html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 24px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #ec4899; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin: 0;">Welcome!</h1>
                </div>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">You have been invited to join the <strong>Hakika app</strong> as a <strong>${role}</strong> for unit <strong>${companyCode}</strong>.</p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">Please click the button below to complete your registration and onboard into the system.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" style="background-color: #ec4899; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">Complete Registration</a>
                </div>
                
                <div style="background-color: #f9fafb; padding: 24px; border-radius: 16px; margin: 30px 0; border: 1px solid #f3f4f6;">
                    <p style="margin: 0; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Invitation Details</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px;"><strong>Role:</strong> ${role}</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px;"><strong>Unit:</strong> ${companyCode}</p>
                </div>

                <p style="color: #374151; font-size: 16px; line-height: 1.6; text-align: center; background-color: #fff5f7; padding: 12px; border-radius: 8px; border: 1px dashed #ec4899;">
                    <strong>Note:</strong> Your official system credentials will be generated and emailed to you automatically once you complete this registration.
                </p>

                <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center; margin-top: 20px;">This link will expire in 7 days. If you did not expect this invitation, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0;" />
                <p style="color: #9ca3af; font-size: 10px; text-align: center; font-weight: 500;">© 2026 Hakika app. All rights reserved.</p>
            </div>
        `
    }),
    accountDeleted: (userName: string, deletedBy: string) => ({
        subject: 'Account Deletion Notice - Hakika app',
        html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 24px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #ef4444; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin: 0;">Account Deleted</h1>
                </div>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">This is to inform you that your administrative account for <strong>Hakika app</strong> has been deleted.</p>
                
                <div style="background-color: #fef2f2; padding: 24px; border-radius: 16px; margin: 30px 0; border: 1px solid #fee2e2;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px;">This action was performed by: <strong>${deletedBy}</strong></p>
                </div>

                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">If you believe this was an error, please contact your department supervisor immediately.</p>
                <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0;" />
                <p style="color: #9ca3af; font-size: 10px; text-align: center; font-weight: 500;">© 2026 Hakika app. All rights reserved.</p>
            </div>
        `
    })

};

/**
 * Specialized helper for sending employee credentials (matches existing usage in Credentials page)
 */
export const sendEmployeeCredentials = async (
    email: string,
    fullName: string,
    username: string,
    password?: string
) => {
    const template = EmailTemplates.credentialsCreated(fullName, {
        email,
        username,
        password
    });
    
    return sendEmail({
        to: email,
        subject: template.subject,
        html: template.html
    });
};
