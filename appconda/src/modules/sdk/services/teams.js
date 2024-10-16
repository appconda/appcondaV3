const Service = require('../service.js');
const RealmoceanException = require('../exception.js');
const InputFile = require('../inputFile.js');
const client = require('../client.js');
const Stream = require('stream');
const { promisify } = require('util');
const fs = require('fs');

class Teams extends Service {

    constructor(client) {
        super(client);
    }


    /**
     * List teams
     *
     * Get a list of all the teams in which the current user is a member. You can
     * use the parameters to filter your results.
     *
     * @param {string[]} queries
     * @param {string} search
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async list(projectId, queries, search) {

        this.client.setProject(projectId);

        const apiPath = '/teams';
        let payload = {};

        if (typeof queries !== 'undefined') {
            payload['queries'] = queries;
        }

        if (typeof search !== 'undefined') {
            payload['search'] = search;
        }

        return await this.client.call('get', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Create team
     *
     * Create a new team. The user who creates the team will automatically be
     * assigned as the owner of the team. Only the users with the owner role can
     * invite new members, add new owners and delete or update the team.
     *
     * @param {string} teamId
     * @param {string} name
     * @param {string[]} roles
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async create(projectId, teamId, name, roles) {

        this.client.setProject(projectId);

        const apiPath = '/teams';
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof name === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "name"');
        }


        if (typeof teamId !== 'undefined') {
            payload['teamId'] = teamId;
        }

        if (typeof name !== 'undefined') {
            payload['name'] = name;
        }

        if (typeof roles !== 'undefined') {
            payload['roles'] = roles;
        }

        return await this.client.call('post', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Get team
     *
     * Get a team by its ID. All team members have read access for this resource.
     *
     * @param {string} teamId
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async get(teamId) {
        const apiPath = '/teams/{teamId}'.replace('{teamId}', teamId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }


        return await this.client.call('get', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Update name
     *
     * Update the team's name by its unique ID.
     *
     * @param {string} teamId
     * @param {string} name
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async updateName(teamId, name) {
        const apiPath = '/teams/{teamId}'.replace('{teamId}', teamId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof name === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "name"');
        }


        if (typeof name !== 'undefined') {
            payload['name'] = name;
        }

        return await this.client.call('put', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Delete team
     *
     * Delete a team using its ID. Only team members with the owner role can
     * delete the team.
     *
     * @param {string} teamId
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async delete(teamId) {
        const apiPath = '/teams/{teamId}'.replace('{teamId}', teamId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }


        return await this.client.call('delete', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * List team memberships
     *
     * Use this endpoint to list a team's members using the team's ID. All team
     * members have read access to this endpoint.
     *
     * @param {string} teamId
     * @param {string[]} queries
     * @param {string} search
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async listMemberships(teamId, queries, search) {
        const apiPath = '/teams/{teamId}/memberships'.replace('{teamId}', teamId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }


        if (typeof queries !== 'undefined') {
            payload['queries'] = queries;
        }

        if (typeof search !== 'undefined') {
            payload['search'] = search;
        }

        return await this.client.call('get', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Create team membership
     *
     * Invite a new member to join your team. Provide an ID for existing users, or
     * invite unregistered users using an email or phone number. If initiated from
     * a Client SDK, Appconda will send an email or sms with a link to join the
     * team to the invited user, and an account will be created for them if one
     * doesn't exist. If initiated from a Server SDK, the new member will be added
     * automatically to the team.
     * 
     * You only need to provide one of a user ID, email, or phone number. Appconda
     * will prioritize accepting the user ID > email > phone number if you provide
     * more than one of these parameters.
     * 
     * Use the `url` parameter to redirect the user from the invitation email to
     * your app. After the user is redirected, use the [Update Team Membership
     * Status](https://appconda.io/docs/references/cloud/client-web/teams#updateMembershipStatus)
     * endpoint to allow the user to accept the invitation to the team. 
     * 
     * Please note that to avoid a [Redirect
     * Attack](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.md)
     * Appconda will accept the only redirect URLs under the domains you have
     * added as a platform on the Appconda Console.
     * 
     *
     * @param {string} teamId
     * @param {string[]} roles
     * @param {string} email
     * @param {string} userId
     * @param {string} phone
     * @param {string} url
     * @param {string} name
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async createMembership(teamId, roles, email, userId, phone, url, name) {
        const apiPath = '/teams/{teamId}/memberships'.replace('{teamId}', teamId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof roles === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "roles"');
        }


        if (typeof email !== 'undefined') {
            payload['email'] = email;
        }

        if (typeof userId !== 'undefined') {
            payload['userId'] = userId;
        }

        if (typeof phone !== 'undefined') {
            payload['phone'] = phone;
        }

        if (typeof roles !== 'undefined') {
            payload['roles'] = roles;
        }

        if (typeof url !== 'undefined') {
            payload['url'] = url;
        }

        if (typeof name !== 'undefined') {
            payload['name'] = name;
        }

        return await this.client.call('post', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Get team membership
     *
     * Get a team member by the membership unique id. All team members have read
     * access for this resource.
     *
     * @param {string} teamId
     * @param {string} membershipId
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async getMembership(teamId, membershipId) {
        const apiPath = '/teams/{teamId}/memberships/{membershipId}'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof membershipId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "membershipId"');
        }


        return await this.client.call('get', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Update membership
     *
     * Modify the roles of a team member. Only team members with the owner role
     * have access to this endpoint. Learn more about [roles and
     * permissions](https://appconda.io/docs/permissions).
     * 
     *
     * @param {string} teamId
     * @param {string} membershipId
     * @param {string[]} roles
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async updateMembership(teamId, membershipId, roles) {
        const apiPath = '/teams/{teamId}/memberships/{membershipId}'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof membershipId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "membershipId"');
        }

        if (typeof roles === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "roles"');
        }


        if (typeof roles !== 'undefined') {
            payload['roles'] = roles;
        }

        return await this.client.call('patch', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Delete team membership
     *
     * This endpoint allows a user to leave a team or for a team owner to delete
     * the membership of any other team member. You can also use this endpoint to
     * delete a user membership even if it is not accepted.
     *
     * @param {string} teamId
     * @param {string} membershipId
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async deleteMembership(teamId, membershipId) {
        const apiPath = '/teams/{teamId}/memberships/{membershipId}'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof membershipId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "membershipId"');
        }


        return await this.client.call('delete', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Update team membership status
     *
     * Use this endpoint to allow a user to accept an invitation to join a team
     * after being redirected back to your app from the invitation email received
     * by the user.
     * 
     * If the request is successful, a session for the user is automatically
     * created.
     * 
     *
     * @param {string} teamId
     * @param {string} membershipId
     * @param {string} userId
     * @param {string} secret
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async updateMembershipStatus(teamId, membershipId, userId, secret) {
        const apiPath = '/teams/{teamId}/memberships/{membershipId}/status'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof membershipId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "membershipId"');
        }

        if (typeof userId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "userId"');
        }

        if (typeof secret === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "secret"');
        }


        if (typeof userId !== 'undefined') {
            payload['userId'] = userId;
        }

        if (typeof secret !== 'undefined') {
            payload['secret'] = secret;
        }

        return await this.client.call('patch', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Get team preferences
     *
     * Get the team's shared preferences by its unique ID. If a preference doesn't
     * need to be shared by all team members, prefer storing them in [user
     * preferences](https://appconda.io/docs/references/cloud/client-web/account#getPrefs).
     *
     * @param {string} teamId
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async getPrefs(teamId) {
        const apiPath = '/teams/{teamId}/prefs'.replace('{teamId}', teamId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }


        return await this.client.call('get', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }

    /**
     * Update preferences
     *
     * Update the team's preferences by its unique ID. The object you pass is
     * stored as is and replaces any previous value. The maximum allowed prefs
     * size is 64kB and throws an error if exceeded.
     *
     * @param {string} teamId
     * @param {object} prefs
     * @throws {RealmoceanException}
     * @returns {Promise}
     */
    async updatePrefs(teamId, prefs) {
        const apiPath = '/teams/{teamId}/prefs'.replace('{teamId}', teamId);
        let payload = {};
        if (typeof teamId === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "teamId"');
        }

        if (typeof prefs === 'undefined') {
            throw new RealmoceanException('Missing required parameter: "prefs"');
        }


        if (typeof prefs !== 'undefined') {
            payload['prefs'] = prefs;
        }

        return await this.client.call('put', apiPath, {
            'content-type': 'application/json',
        }, payload);
    }
}

module.exports = Teams;
