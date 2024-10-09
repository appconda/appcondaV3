import { useTranslation } from "react-i18next";
import type { FunctionComponent } from "../common/types";
import { Client, Account } from "@appconda/console-sdk";
import { HStack, Text, VStack } from "tuval";
import { useRouter } from "@tanstack/react-router";

const client = new Client()
	.setEndpoint('http://localhost/v1') // Your API Endpoint
	.setProject('console');

const account = new Account(client);



export const Home = (): FunctionComponent => {
	const { t, i18n } = useTranslation();
	const router = useRouter();
	const deleteSession = async (): Promise<void> => {
		try {	
			const result = await account.deleteSession('current');
			console.log(result);
			router.navigate({ to: '/login' });
		} catch (error) {
			console.log(error);
		}
	}

	const onTranslateButtonClick = async (): Promise<void> => {


		const promise = account.createEmailPasswordSession('mert@example.com', 'AAA123bbb');

		promise.then(function (response) {
			console.log(response); // Success
		}, function (error) {
			console.log(error); // Failure
		});

		/* const promise = account.create('mert', 'mert@example.com', 'AAA123bbb');

		promise.then(function (response) {
			console.log(response); // Success
		}, function (error) {
			console.log(error); // Failure
		}); */
		/* if (i18n.resolvedLanguage === "en") {
			await i18n.changeLanguage("es");
		} else {
			await i18n.changeLanguage("en");
		} */
	};

	const onLogin = async (): Promise<void> => {

		const result = await account.get();

		console.log(result);

		/* const promise = account.getPrefs();

		promise.then(function (response) {
			console.log(response); // Success
		}, function (error) {
			console.log(error); // Failure
		});  */

		/* 	 const promise = account.createEmailPasswordSession('mert@example.com', 'AAA123bbb');
	
			promise.then(function (response) {
				console.log(response); // Success
			}, function (error) {
				console.log(error); // Failure
			});  */

		/* const promise = account.create('mert', 'mert@example.com', 'AAA123bbb');

		promise.then(function (response) {
			console.log(response); // Success
		}, function (error) {
			console.log(error); // Failure
		}); */
		/* if (i18n.resolvedLanguage === "en") {
			await i18n.changeLanguage("es");
		} else {
			await i18n.changeLanguage("en");
		} */
	};

	return (
		VStack(
			VStack(
				Text('Hello World')
			),
			VStack(
				<div className="bg-blue-300  font-bold w-screen h-screen flex flex-col justify-center items-center">
					<p className="text-white text-6xl">{t("home.greeting")}</p>
					<button type="submit" onClick={onTranslateButtonClick}>
						login
					</button>
					<button type="submit" onClick={onLogin}>
						prefs
					</button>
					<button type="submit" onClick={deleteSession}>
						logout
					</button>
				</div>
			)

		).render()
	);
};
